import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MediaService } from '../../services/media.service';
import { SignalingFacade } from '../../services/signaling/signaling.facade';
import { UserService } from '../../services/user.service';
import { JitsiMeetService } from '../../services/video/jitsi-meet.service';
import { VideoCallFacade } from '../../services/video/video-call.facade';
import { CallRoomBase } from './call-room.base';

@Component({
  selector: 'app-jitsi-room',
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.css'],
})
export class JitsiRoomComponent extends CallRoomBase {
  constructor(
    route: ActivatedRoute,
    router: Router,
    media: MediaService,
    video: VideoCallFacade,
    signaling: SignalingFacade,
    users: UserService,
    private jitsi: JitsiMeetService
  ) {
    super(route, router, media, video, signaling, users);
  }

  protected async connect(): Promise<void> {
    const host = this.providerHost?.nativeElement;
    if (!host) {
      throw new Error('Jitsi host element is missing.');
    }
    const join = await this.video.getJitsiJoinConfig(
      this.currentUserId,
      this.remoteUserId,
      this.user?.userName || `User ${this.currentUserId}`
    );
    await this.jitsi.join({
      container: host,
      ...join,
      onLeft: () => {
        if (!this.ending && !this.destroyed) {
          this.endCall().catch(() => undefined);
        }
      },
    });
    this.isLoading = false;
  }

  protected async disconnect(): Promise<void> {
    await this.jitsi.hangup();
  }

  override toggleMic(): void {
    super.toggleMic();
    this.jitsi.command('toggleAudio');
  }

  override toggleCamera(): void {
    super.toggleCamera();
    this.jitsi.command('toggleVideo');
  }

  protected override async onShareStarted(): Promise<void> {
    this.jitsi.command('toggleShareScreen');
  }

  protected override async onShareStopped(): Promise<void> {
    this.jitsi.command('toggleShareScreen');
  }
}
