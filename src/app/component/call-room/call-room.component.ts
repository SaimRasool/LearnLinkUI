import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  Inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserVM } from 'src/app/models/usersVM';
import { MediaService } from 'src/app/services/media.service';
import { SignalRService } from 'src/app/services/signalR.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-call-room',
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.css'],
})
export class CallRoomComponent implements OnInit, AfterViewInit, OnDestroy {
  // -----------------------------------------------------------------
  // ViewChildren
  // -----------------------------------------------------------------
  @ViewChild('localVideo', { static: true })
  localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: true })
  remoteVideo!: ElementRef<HTMLVideoElement>;

  // -----------------------------------------------------------------
  // Component state
  // -----------------------------------------------------------------
  private peerConnection!: RTCPeerConnection;
  private localStream!: MediaStream;
  private pendingIceCandidates: RTCIceCandidate[] = [];
  private subs: Subscription[] = [];
  private isDestroyed = false;

  // -----------------------------------------------------------------
  // Route / user info
  // -----------------------------------------------------------------
  remoteUserId!: string;
  currentUserId!: string;
  isCaller = false; // true → we send the offer
  micEnabled = true;
  cameraEnabled = true;
  user: UserVM | null = null;
  isLoading :boolean= true;
  // -----------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mediaService: MediaService,
    private signalRService: SignalRService,
    private accountService: UserService
  ) {}

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------
  ngOnInit(): void {
    if (this.isDestroyed) return;
    this.accountService.user.subscribe((x) => (this.user = x));

    // 1. Read route + user
    this.remoteUserId = this.route.snapshot.paramMap.get('id')!;
    this.currentUserId = this.user?.userId!.toString() ?? '0';
    this.isCaller = this.currentUserId !== this.remoteUserId;
    // 1. Start media + PC
    this.startMediaAndPeerConnection()
      .then(() => {
        this.isLoading = false;
        // 2. NOW safe to create offer
        this.setupSignalRHandlers();
        if (this.isCaller) {
          this.initiateOffer(); // ← peerConnection is READY
        }
      })
      .catch((err) => {
        console.error('Failed to start media/PC', err);
      });
  }

  ngAfterViewInit(): void {
    // Attach local preview as soon as video elements exist
    if (this.localStream) {
      this.localVideo.nativeElement.srcObject = this.localStream;
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.cleanup();
  }

  // -----------------------------------------------------------------
  // 1. Media + fresh PeerConnection
  // -----------------------------------------------------------------
  private async startMediaAndPeerConnection(): Promise<void> {
    // ---- get user media ------------------------------------------------
    await this.mediaService.loadDevices();
    await this.mediaService.requestPermissions();
    this.localStream = await this.mediaService.startPreview(
      this.localVideo.nativeElement
    );

    // ---- create a *new* PC ------------------------------------------------
    this.createPeerConnection();
  }

  private createPeerConnection(): void {
    // Close any previous (should never happen, but safe)
    if (
      this.peerConnection &&
      this.peerConnection.signalingState !== 'closed'
    ) {
      this.peerConnection.close();
    }

    const config = {
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      // add TURN here if you have one
    };
    this.peerConnection = new RTCPeerConnection(config);

    // Add local tracks
    this.localStream.getTracks().forEach((track) => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    this.attachPeerConnectionEvents();
  }

  private attachPeerConnectionEvents(): void {
    // ---- remote stream --------------------------------------------------
    this.peerConnection.ontrack = (ev) => {
      if (this.remoteVideo.nativeElement.srcObject) return;
      this.remoteVideo.nativeElement.srcObject = ev.streams[0];
    };

    // ---- ICE candidate --------------------------------------------------
    this.peerConnection.onicecandidate = (ev) => {
      if (ev.candidate && !this.isDestroyed) {
        this.signalRService.sendIceCandidate(this.remoteUserId, ev.candidate);
      }
    };

    // ---- ICE state changes ---------------------------------------------
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log('%cICE state →', 'color:orange', state);

      if (state === 'failed' || state === 'closed') {
        this.restartIceNegotiation();
      }
    };
  }

  // -----------------------------------------------------------------
  // 2. SignalR handlers (with guards)
  // -----------------------------------------------------------------
  private setupSignalRHandlers(): void {
    // ---- Offer (callee) -------------------------------------------------
    this.subs.push(
      this.signalRService.receiveOffer$.subscribe(
        async ({ sdp: sdpStr, from }) => {
          if (this.isDestroyed || from !== this.remoteUserId) return;

          const offer = JSON.parse(sdpStr) as RTCSessionDescriptionInit;
          await this.safeSetRemoteDescription(offer);

          // create answer
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          await this.signalRService.sendAnswer(
            this.remoteUserId,
            this.peerConnection.localDescription!
          );
        }
      )
    );

    // ---- Answer (caller) ------------------------------------------------
    this.subs.push(
      this.signalRService.receiveAnswer$.subscribe(
        async ({ sdp: sdpStr, from }) => {
          if (this.isDestroyed || from !== this.remoteUserId) return;

          const answer = JSON.parse(sdpStr) as RTCSessionDescriptionInit;
          await this.safeSetRemoteDescription(answer);
        }
      )
    );

    // ---- ICE candidate --------------------------------------------------
    this.subs.push(
      this.signalRService.receiveIceCandidate$.subscribe(
        ({ candidate: candStr, from }) => {
          if (this.isDestroyed || from !== this.remoteUserId) return;

          const cand = new RTCIceCandidate(JSON.parse(candStr));
          if (this.peerConnection.remoteDescription) {
            this.peerConnection.addIceCandidate(cand).catch(() => {});
          } else {
            this.pendingIceCandidates.push(cand);
          }
        }
      )
    );

    // ---- Call ended -----------------------------------------------------
    this.subs.push(
      this.signalRService.callEnded$.subscribe(() => this.endCall())
    );
  }

  // -----------------------------------------------------------------
  // 3. Offer initiation (caller only)
  // -----------------------------------------------------------------
  private async initiateOffer(): Promise<void> {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      await this.signalRService.sendOffer(
        this.remoteUserId,
        this.peerConnection.localDescription!
      );
    } catch (e) {
      console.error('Offer creation failed', e);
    }
  }

  // -----------------------------------------------------------------
  // 4. Safe setRemoteDescription + flush queued ICE
  // -----------------------------------------------------------------
  private async safeSetRemoteDescription(
    desc: RTCSessionDescriptionInit
  ): Promise<void> {
    if (this.isDestroyed) return;

    if (this.peerConnection.signalingState === 'closed') {
      console.warn('PC closed – recreating');
      this.createPeerConnection();
    }

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription(desc)
    );
    this.flushPendingIceCandidates();
  }

  private flushPendingIceCandidates(): void {
    if (!this.peerConnection.remoteDescription) return;

    this.pendingIceCandidates.forEach((c) => {
      this.peerConnection.addIceCandidate(c).catch(() => {});
    });
    this.pendingIceCandidates = [];
  }

  // -----------------------------------------------------------------
  // 5. ICE restart (modern way)
  // -----------------------------------------------------------------
  private async restartIceNegotiation(): Promise<void> {
    if (this.isDestroyed) return;
    if (this.peerConnection.signalingState !== 'stable') {
      console.warn('Cannot restart ICE – not stable');
      return;
    }

    try {
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);
      await this.signalRService.sendOffer(
        this.remoteUserId,
        this.peerConnection.localDescription!
      );
      console.log('%cICE restart sent', 'color:lime');
    } catch (e) {
      console.error('ICE restart failed', e);
    }
  }

  // -----------------------------------------------------------------
  // 6. UI controls
  // -----------------------------------------------------------------
  toggleMic(): void {
    this.micEnabled = !this.micEnabled;
    this.mediaService.toggleMic(this.micEnabled);
  }

  toggleCamera(): void {
    this.cameraEnabled = !this.cameraEnabled;
    this.mediaService.toggleCamera(
      this.cameraEnabled,
      this.localVideo.nativeElement
    );
  }

 async endCall(): Promise<void> {
    await this.signalRService.endCall(this.remoteUserId);
    await this.cleanup();
    this.router.navigate(['/messenger']); // <-- change to your list page
  }

  // -----------------------------------------------------------------
  // 7. Cleanup
  // -----------------------------------------------------------------
  private async cleanup(): Promise<void> {
   await this.subs.forEach((s) => s.unsubscribe());
    this.subs = [];

    if (
      this.peerConnection &&
      this.peerConnection.signalingState !== 'closed'
    ) {
      this.peerConnection.close();
    }
    await this.mediaService.stopPreview();
  }
}
