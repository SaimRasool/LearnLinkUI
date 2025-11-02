import { AfterViewInit, Component, ElementRef,  OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { UserVM } from 'src/app/models/usersVM';
import { MediaService } from 'src/app/services/media.service';
import { SignalRService } from 'src/app/services/signalR.service';
import { UserService } from 'src/app/services/user.service';


@Component({
  selector: 'app-call-grid',
  templateUrl: './call-grid.component.html',
  styleUrls: ['./call-grid.component.css'],
})
export class CallGridComponent implements OnInit, OnDestroy,AfterViewInit {
  @ViewChild('videoPreview', { static: true })
  videoPreview!: ElementRef<HTMLVideoElement>;
  showCallGrid: boolean = true;
  audioInputs$!: Observable<MediaDeviceInfo[]>;
  audioOutputs$!: Observable<MediaDeviceInfo[]>;
  videoDevices$!: Observable<MediaDeviceInfo[]>;
  receiverId: string | null | undefined;
  selectedMicId: string | undefined;
  selectedCamId: string | undefined;
  private previewStream?: MediaStream;
  private subs: Subscription[] = [];
  user: UserVM | null = null;

  constructor(
    public mediaService: MediaService,
    private route: ActivatedRoute,
    private signalRservice: SignalRService,
    private accountService: UserService
  ) {}

  async ngOnInit() {
    // Load available media devices
    this.mediaService.loadDevices();

    this.audioInputs$ = this.mediaService.audioInputs$;
    this.audioOutputs$ = this.mediaService.audioOutputs$;
    this.videoDevices$ = this.mediaService.videoDevices$;
    this.audioInputs$.subscribe((mics) => {
      if (mics && mics.length > 0) {
        this.selectedMicId = mics[1].deviceId; // default = first microphone
      }
    });
    this.videoDevices$.subscribe((cams) => {
      if (cams && cams.length > 0) {
        this.selectedCamId = cams[1].deviceId; // default = first microphone
      }
    });
    this.accountService.user.subscribe((x) => (this.user = x));

    await this.mediaService.refreshPermissions();

    await this.mediaService.initPermissions();
    this.receiverId = this.route.snapshot.paramMap.get('id');
    const type =
      this.route.snapshot.queryParamMap.get('type') ?? 'defaultValue';

    if (type === 'rac') {
      this.showCallGrid = false;
    }

    this.signalRservice.callAccepted$.subscribe((acceptedCalleeId) => {
      if (Number(acceptedCalleeId) === this.user?.userId) {
        this.showCallGrid = false;
      }
    });
    // Start preview stream
    // this.previewStream = await this.mediaService.startPreview(
    //   this.videoPreview!.nativeElement
    // );
  }
  async ngAfterViewInit() {
    this.previewStream = await this.mediaService.startPreview(
      this.videoPreview.nativeElement
    );
  }
  /** Called when dropdowns change */
  async onDeviceChange(
    videoId?: string | null,
    audioInId?: string | null,
    audioOutId?: string | null
  ) {
    if (videoId === 'none') {
      this.mediaService.toggleCamera(true, this.videoPreview.nativeElement);
    } else if (videoId) {
      this.selectedCamId = videoId;
      await this.mediaService.changeCamera(
        videoId,
        this.videoPreview.nativeElement
      );
      this.mediaService.toggleCamera(false, this.videoPreview.nativeElement);
    }

    if (audioInId === 'none') {
      this.mediaService.toggleMic(true);
    } else if (audioInId) {
      this.selectedMicId = audioInId;
      await this.mediaService.changeMicrophone(audioInId);
      this.mediaService.toggleMic(false);
    }

    if (audioOutId && audioOutId !== 'none') {
      await this.mediaService.changeSpeaker(audioOutId);
    }
  }

  toggleMic() {
    this.mediaService.toggleMic(!this.mediaService.microphonePrivacy);
  }

  toggleCamera() {
    this.mediaService.toggleCamera(
      !this.mediaService.cameraPrivacy,
      this.videoPreview.nativeElement
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.mediaService.stopPreview();
  }

  async retryPermission() {
    await this.mediaService.requestPermissions();
    // restart preview if permissions granted
    if (
      this.mediaService.camPermission === 'granted' ||
      this.mediaService.micPermission === 'granted'
    ) {
      try {
        this.previewStream = await this.mediaService.startPreview(
          this.videoPreview.nativeElement
        );
      } catch {}
    }
  }

  joinCall() {
    this.signalRservice.initiateCall(
      this.user?.userId!.toString()!,
      this.receiverId!
    );
  }
}