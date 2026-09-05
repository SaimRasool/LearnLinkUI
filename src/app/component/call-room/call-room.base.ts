import { AfterViewInit, Directive, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserVM } from '../../models/usersVM';
import { MediaService } from '../../services/media.service';
import { SignalingFacade } from '../../services/signaling/signaling.facade';
import { UserService } from '../../services/user.service';
import { VideoCallFacade } from '../../services/video/video-call.facade';

/** Shared call chrome: local preview from MediaService, same buttons, provider label. */
@Directive()
export abstract class CallRoomBase implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('localVideo') localVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('providerHost') providerHost?: ElementRef<HTMLDivElement>;

  remoteUserId = '';
  currentUserId = '';
  isCaller = false;
  user: UserVM | null = null;
  remoteName = 'Connecting';
  isLoading = true;
  errorMessage = '';
  usesRemoteVideo = false;

  protected ending = false;
  protected destroyed = false;
  protected subs: Subscription[] = [];

  constructor(
    protected route: ActivatedRoute,
    protected router: Router,
    public media: MediaService,
    public video: VideoCallFacade,
    protected signaling: SignalingFacade,
    protected users: UserService
  ) {}

  get providerName(): string {
    return this.video.getProviderMeta().name;
  }

  get canShare(): boolean {
    return this.video.features.screenShare;
  }

  get canRecord(): boolean {
    return this.video.features.recording;
  }

  ngOnInit(): void {
    this.user = this.users.userValue;
    this.remoteUserId = this.route.snapshot.paramMap.get('id') || '';
    this.currentUserId = String(this.user?.userId ?? '');
    const role = this.route.snapshot.queryParamMap.get('role');
    const type = this.route.snapshot.queryParamMap.get('type');
    this.isCaller = role === 'caller' || (!role && type !== 'rac');
    if (this.remoteUserId) {
      this.users.getUser(this.remoteUserId).subscribe({
        next: (u) => (this.remoteName = u.userName || this.remoteName),
        error: () => undefined,
      });
    }
    this.subs.push(this.signaling.callEnded$.subscribe(() => this.leaveLocally()));
  }

  ngAfterViewInit(): void {
    this.showLocal();
    this.connect().catch((err) => {
      console.error(err);
      this.errorMessage = err instanceof Error ? err.message : 'Could not start the call.';
      this.isLoading = false;
    });
  }

  toggleMic(): void {
    this.media.toggleMic(this.media.microphonePrivacy);
  }

  toggleCamera(): void {
    this.media.toggleCamera(this.media.cameraPrivacy, this.localVideo?.nativeElement);
  }

  async toggleShare(): Promise<void> {
    if (!this.canShare) {
      return;
    }
    if (this.media.sharingScreen) {
      this.media.stopScreenShare();
      await this.onShareStopped();
      return;
    }
    await this.media.startScreenShare();
    await this.onShareStarted();
  }

  toggleRecord(): void {
    if (!this.canRecord) {
      return;
    }
    if (this.media.recording) {
      this.media.stopRecording();
    } else {
      this.media.startRecording();
    }
  }

  async endCall(): Promise<void> {
    if (this.ending) {
      return;
    }
    this.ending = true;
    if (this.remoteUserId) {
      await this.signaling.endCall(this.remoteUserId).catch(() => undefined);
    }
    await this.disconnect();
    await this.media.stopPreview();
    this.router.navigate(['/messenger']);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.subs.forEach((s) => s.unsubscribe());
    this.disconnect().catch(() => undefined);
    if (!this.ending) {
      this.media.stopPreview().catch(() => undefined);
    }
  }

  protected showLocal(): void {
    const el = this.localVideo?.nativeElement;
    if (el) {
      this.media.attach(el);
    }
  }

  protected async leaveLocally(): Promise<void> {
    if (this.ending) {
      return;
    }
    this.ending = true;
    await this.disconnect();
    await this.media.stopPreview();
    this.router.navigate(['/messenger']);
  }

  protected abstract connect(): Promise<void>;
  protected abstract disconnect(): Promise<void>;
  protected async onShareStarted(): Promise<void> {}
  protected async onShareStopped(): Promise<void> {}
}
