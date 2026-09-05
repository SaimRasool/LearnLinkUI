import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserVM } from 'src/app/models/usersVM';
import { MediaService } from 'src/app/services/media.service';
import { UserService } from 'src/app/services/user.service';
import { SignalingFacade } from 'src/app/services/signaling/signaling.facade';
import { VideoCallFacade } from 'src/app/services/video/video-call.facade';
import { JitsiMeetService } from 'src/app/services/video/jitsi-meet.service';
import { VideoProviderId } from 'src/app/models/app-settings';

@Component({
  selector: 'app-call-room',
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.css'],
})
export class CallRoomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('localVideo') localVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo?: ElementRef<HTMLVideoElement>;

  remoteUserId = '';
  currentUserId = '';
  isCaller = false;
  micEnabled = true;
  cameraEnabled = true;
  user: UserVM | null = null;
  remoteName = 'Connecting';
  isLoading = true;
  errorMessage = '';
  provider: VideoProviderId = 'webrtc';
  embedUrl: SafeResourceUrl | null = null;
  rawEmbedUrl: string | null = null;
  providerConfigured = true;
  jitsiError = '';

  private peerConnection?: RTCPeerConnection;
  private localStream?: MediaStream;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private subs: Subscription[] = [];
  private isDestroyed = false;
  private ending = false;
  private offerInFlight = false;
  private pendingOffer?: { sdp: string; from: string };
  private mediaStarted = false;
  private jitsiStarted = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mediaService: MediaService,
    private signaling: SignalingFacade,
    private accountService: UserService,
    public video: VideoCallFacade,
    private jitsi: JitsiMeetService
  ) {}

  get isNativeWebrtc(): boolean {
    return this.provider === 'webrtc';
  }

  get isJitsi(): boolean {
    return this.provider === 'jitsi';
  }

  @ViewChild('jitsiContainer')
  set jitsiContainer(el: ElementRef<HTMLDivElement> | undefined) {
    if (!el || !this.isJitsi || this.jitsiStarted || this.isDestroyed) {
      return;
    }
    this.jitsiStarted = true;
    this.startJitsi(el.nativeElement);
  }

  ngOnInit(): void {
    this.user = this.accountService.userValue;
    this.remoteUserId = this.route.snapshot.paramMap.get('id') || '';
    this.currentUserId = String(this.user?.userId ?? '');
    const role = this.route.snapshot.queryParamMap.get('role');
    const type = this.route.snapshot.queryParamMap.get('type');
    this.isCaller = role === 'caller' || (!role && type !== 'rac');
    this.provider = this.video.provider;
    this.providerConfigured = this.video.isConfigured();
    this.rawEmbedUrl = this.video.getEmbedUrl(this.currentUserId, this.remoteUserId);
    this.embedUrl = this.video.getSafeEmbedUrl(this.currentUserId, this.remoteUserId);

    if (this.remoteUserId) {
      this.accountService.getUser(this.remoteUserId).subscribe({
        next: (u) => (this.remoteName = u.userName || this.remoteName),
        error: () => undefined,
      });
    }

    this.setupSignalingHandlers();

    if (!this.isNativeWebrtc) {
      this.isLoading = this.isJitsi;
    }
  }

  ngAfterViewInit(): void {
    if (!this.isNativeWebrtc || this.mediaStarted) {
      return;
    }
    this.mediaStarted = true;
    this.startWebRtc().catch((err) => {
      console.error('Failed to start media/PC', err);
      this.errorMessage = 'Could not start the camera or microphone.';
      this.isLoading = false;
    });
  }

  toggleMic(): void {
    this.micEnabled = !this.micEnabled;
    this.mediaService.toggleMic(this.micEnabled);
  }

  toggleCamera(): void {
    this.cameraEnabled = !this.cameraEnabled;
    this.mediaService.toggleCamera(this.cameraEnabled, this.localVideo?.nativeElement);
  }

  async endCall(): Promise<void> {
    if (this.ending) {
      return;
    }
    this.ending = true;
    if (this.remoteUserId) {
      await this.signaling.endCall(this.remoteUserId).catch(() => undefined);
    }
    if (this.isJitsi) {
      await this.jitsi.hangup().catch(() => undefined);
    }
    await this.cleanup();
    this.router.navigate(['/messenger']);
  }

  openExternal(): void {
    if (this.rawEmbedUrl) {
      window.open(this.rawEmbedUrl, '_blank', 'noopener');
    }
  }

  useWebrtcInstead(): void {
    this.router.navigate(['/settings']);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanup();
  }

  private async startJitsi(container: HTMLElement): Promise<void> {
    let join;
    try {
      join = await this.video.getJitsiJoinConfig(
        this.currentUserId,
        this.remoteUserId,
        this.user?.userName || `User ${this.currentUserId}`
      );
    } catch (err) {
      console.error('Jitsi JWT failed', err);
      this.jitsiError =
        'Jitsi keys in call.config.ts are invalid. Use meet.ffmuc.net with empty keys, or paste a valid JaaS JWT / PKCS#8 private key.';
      this.isLoading = false;
      return;
    }
    const jwt = join.jwt ? `?jwt=${encodeURIComponent(join.jwt)}` : '';
    const app = join.appId ? `${encodeURIComponent(join.appId)}/` : '';
    this.rawEmbedUrl = `https://${join.domain}/${app}${join.roomName}${jwt}`;
    try {
      await this.jitsi.join({
        container,
        ...join,
        onLeft: () => {
          if (!this.ending && !this.isDestroyed) {
            this.endCall().catch(() => undefined);
          }
        },
      });
      this.isLoading = false;
    } catch (err) {
      console.error('Jitsi failed to start', err);
      this.jitsiError =
        'Could not embed Jitsi. Public meet.jit.si often blocks embeds — open the room in a new window, or set a self-hosted / 8x8.vc domain in Settings.';
      this.isLoading = false;
    }
  }

  private async startWebRtc(): Promise<void> {
    await this.mediaService.loadDevices();
    const previewEl = this.localVideo?.nativeElement || document.createElement('video');
    this.localStream = await this.mediaService.startPreview(previewEl);
    if (this.localVideo) {
      this.localVideo.nativeElement.srcObject = this.localStream;
    }
    this.createPeerConnection();
    this.isLoading = false;
    if (this.pendingOffer) {
      await this.handleOffer(this.pendingOffer.sdp, this.pendingOffer.from);
      this.pendingOffer = undefined;
    } else if (this.isCaller) {
      await this.initiateOffer();
    }
  }

  private createPeerConnection(): void {
    if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      this.peerConnection.close();
    }

    this.peerConnection = new RTCPeerConnection({
      iceServers: this.video.getIceServers(),
    });

    this.localStream?.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, this.localStream!);
    });

    this.peerConnection.ontrack = (ev) => {
      const remoteEl = this.remoteVideo?.nativeElement;
      if (remoteEl) {
        remoteEl.srcObject = ev.streams[0];
      }
    };

    this.peerConnection.onicecandidate = (ev) => {
      if (ev.candidate && !this.isDestroyed) {
        this.signaling.sendIceCandidate(this.remoteUserId, ev.candidate).catch(() => undefined);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      if (state === 'failed') {
        this.restartIceNegotiation();
      }
    };
  }

  private setupSignalingHandlers(): void {
    this.subs.push(
      this.signaling.receiveOffer$.subscribe(async ({ sdp: sdpStr, from }) => {
        if (this.isDestroyed || from !== this.remoteUserId) {
          return;
        }
        if (!this.peerConnection) {
          this.pendingOffer = { sdp: sdpStr, from };
          return;
        }
        await this.handleOffer(sdpStr, from);
      }),
      this.signaling.receiveAnswer$.subscribe(async ({ sdp: sdpStr, from }) => {
        if (this.isDestroyed || from !== this.remoteUserId || !this.peerConnection) {
          return;
        }
        const answer = JSON.parse(sdpStr) as RTCSessionDescriptionInit;
        await this.safeSetRemoteDescription(answer);
      }),
      this.signaling.receiveIceCandidate$.subscribe(({ candidate: candStr, from }) => {
        if (this.isDestroyed || from !== this.remoteUserId || !this.peerConnection) {
          return;
        }
        const cand = new RTCIceCandidate(JSON.parse(candStr));
        if (this.peerConnection.remoteDescription) {
          this.peerConnection.addIceCandidate(cand).catch(() => undefined);
        } else {
          this.pendingIceCandidates.push(cand);
        }
      }),
      this.signaling.callEnded$.subscribe(() => this.leaveLocally())
    );
  }

  private async handleOffer(sdpStr: string, from: string): Promise<void> {
    if (!this.peerConnection || from !== this.remoteUserId) {
      return;
    }
    const offer = JSON.parse(sdpStr) as RTCSessionDescriptionInit;
    await this.safeSetRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    await this.signaling.sendAnswer(this.remoteUserId, this.peerConnection.localDescription!);
  }

  private async initiateOffer(): Promise<void> {
    if (!this.peerConnection || this.offerInFlight) {
      return;
    }
    this.offerInFlight = true;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      await this.signaling.sendOffer(this.remoteUserId, this.peerConnection.localDescription!);
    } catch (e) {
      console.error('Offer creation failed', e);
    } finally {
      this.offerInFlight = false;
    }
  }

  private async safeSetRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    if (this.isDestroyed || !this.peerConnection) {
      return;
    }
    if (this.peerConnection.signalingState === 'closed') {
      this.createPeerConnection();
    }
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(desc));
    this.flushPendingIceCandidates();
  }

  private flushPendingIceCandidates(): void {
    if (!this.peerConnection?.remoteDescription) {
      return;
    }
    this.pendingIceCandidates.forEach((c) => {
      this.peerConnection?.addIceCandidate(c).catch(() => undefined);
    });
    this.pendingIceCandidates = [];
  }

  private async restartIceNegotiation(): Promise<void> {
    if (this.isDestroyed || this.peerConnection?.signalingState !== 'stable') {
      return;
    }
    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      await this.signaling.sendOffer(this.remoteUserId, this.peerConnection.localDescription!);
    } catch (e) {
      console.error('ICE restart failed', e);
    }
  }

  private async leaveLocally(): Promise<void> {
    if (this.ending) {
      return;
    }
    this.ending = true;
    await this.cleanup();
    this.router.navigate(['/messenger']);
  }

  private async cleanup(): Promise<void> {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];
    if (this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      this.peerConnection.close();
    }
    await this.jitsi.dispose().catch(() => undefined);
    await this.mediaService.stopPreview();
  }
}
