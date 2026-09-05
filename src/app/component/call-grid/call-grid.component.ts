import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { UserVM } from 'src/app/models/usersVM';
import { MediaService } from 'src/app/services/media.service';
import { UserService } from 'src/app/services/user.service';
import { SignalingFacade } from 'src/app/services/signaling/signaling.facade';
import { VideoCallFacade } from 'src/app/services/video/video-call.facade';
import { AlertService } from 'src/app/services/alert.service';

@Component({
  selector: 'app-call-grid',
  templateUrl: './call-grid.component.html',
  styleUrls: ['./call-grid.component.css'],
})
export class CallGridComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoPreview') videoPreview?: ElementRef<HTMLVideoElement>;

  showCallGrid = true;
  waitingForAnswer = false;
  audioInputs$!: Observable<MediaDeviceInfo[]>;
  audioOutputs$!: Observable<MediaDeviceInfo[]>;
  videoDevices$!: Observable<MediaDeviceInfo[]>;
  receiverId: string | null = null;
  selectedMicId?: string;
  selectedCamId?: string;
  user: UserVM | null = null;
  remoteName = 'the other person';
  role: 'caller' | 'callee' = 'caller';

  private subs: Subscription[] = [];

  constructor(
    public mediaService: MediaService,
    public video: VideoCallFacade,
    private route: ActivatedRoute,
    private router: Router,
    private signaling: SignalingFacade,
    private accountService: UserService,
    private alertService: AlertService
  ) {}

  get needsLocalPreview(): boolean {
    return this.video.usesLocalPreview();
  }

  get signalingOpen(): boolean {
    return this.signaling.isOpen;
  }

  async ngOnInit(): Promise<void> {
    this.audioInputs$ = this.mediaService.audioInputs$;
    this.audioOutputs$ = this.mediaService.audioOutputs$;
    this.videoDevices$ = this.mediaService.videoDevices$;
    this.user = this.accountService.userValue;
    this.receiverId = this.route.snapshot.paramMap.get('id');
    const type = this.route.snapshot.queryParamMap.get('type');
    const roleParam = this.route.snapshot.queryParamMap.get('role');
    this.role = roleParam === 'callee' || type === 'rac' ? 'callee' : 'caller';
    this.showCallGrid = this.role === 'caller';

    this.subs.push(
      this.audioInputs$.subscribe((mics) => {
        this.selectedMicId = this.mediaService.firstRealDevice(mics)?.deviceId;
      }),
      this.videoDevices$.subscribe((cams) => {
        this.selectedCamId = this.mediaService.firstRealDevice(cams)?.deviceId;
      }),
      this.signaling.callAccepted$.subscribe(() => {
        if (this.role === 'caller') {
          this.enterRoom();
        }
      }),
      this.signaling.callEnded$.subscribe(() => {
        if (this.showCallGrid) {
          this.alertService.info('The other person declined or left the call.');
          this.router.navigate(['/messenger']);
        }
      })
    );

    if (this.receiverId) {
      this.accountService.getUser(this.receiverId).subscribe({
        next: (u) => (this.remoteName = u.userName || this.remoteName),
        error: () => undefined,
      });
    }

    if (this.needsLocalPreview) {
      await this.mediaService.initPermissions();
      await this.mediaService.loadDevices();
    }
  }

  async ngAfterViewInit(): Promise<void> {
    if (!this.showCallGrid || !this.needsLocalPreview || !this.videoPreview) {
      return;
    }
    try {
      await this.mediaService.startPreview(this.videoPreview.nativeElement);
    } catch {
      this.alertService.error('Camera or microphone permission is required for a preview.');
    }
  }

  async onDeviceChange(
    videoId?: string | null,
    audioInId?: string | null,
    audioOutId?: string | null
  ): Promise<void> {
    if (!this.videoPreview) {
      return;
    }

    if (videoId === 'none') {
      this.mediaService.toggleCamera(false, this.videoPreview.nativeElement);
    } else if (videoId) {
      this.selectedCamId = videoId;
      await this.mediaService.changeCamera(videoId, this.videoPreview.nativeElement);
    }

    if (audioInId === 'none') {
      this.mediaService.toggleMic(false);
    } else if (audioInId) {
      this.selectedMicId = audioInId;
      await this.mediaService.changeMicrophone(audioInId);
    }

    if (audioOutId && audioOutId !== 'none') {
      await this.mediaService.changeSpeaker(audioOutId);
    }
  }

  toggleMic(): void {
    this.mediaService.toggleMic(this.mediaService.microphonePrivacy);
  }

  toggleCamera(): void {
    this.mediaService.toggleCamera(
      this.mediaService.cameraPrivacy,
      this.videoPreview?.nativeElement
    );
  }

  async retryPermission(): Promise<void> {
    await this.mediaService.requestPermissions();
    if (
      this.videoPreview &&
      (this.mediaService.camPermission === 'granted' ||
        this.mediaService.micPermission === 'granted')
    ) {
      try {
        await this.mediaService.startPreview(this.videoPreview.nativeElement);
      } catch {
        // still denied
      }
    }
  }

  async joinCall(): Promise<void> {
    if (!this.user?.userId || !this.receiverId) {
      return;
    }
    this.waitingForAnswer = true;
    const joinWithoutRing = !this.video.usesLocalPreview();

    try {
      if (!this.signaling.isOpen) {
        await this.signaling.connect(String(this.user.userId));
      }
      await this.signaling.initiateCall(String(this.user.userId), this.receiverId);
      if (joinWithoutRing) {
        this.enterRoom();
      }
    } catch (err) {
      console.error(err);
      if (joinWithoutRing) {
        this.alertService.info(
          'Could not ring the other person. Joining the meeting anyway — they can open the same chat and join.'
        );
        this.enterRoom();
        return;
      }
      this.waitingForAnswer = false;
      this.alertService.error(
        'Could not start the call. In Settings, click “Detect running API”, or start the Communication project.'
      );
    }
  }

  cancelCall(): void {
    if (this.receiverId) {
      this.signaling.endCall(this.receiverId).catch(() => undefined);
    }
    this.router.navigate(['/messenger']);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.showCallGrid) {
      this.mediaService.stopPreview();
    }
  }

  private enterRoom(): void {
    this.mediaService.stopPreview();
    this.showCallGrid = false;
    this.waitingForAnswer = false;
  }
}
