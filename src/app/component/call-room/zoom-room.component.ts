import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MediaService } from '../../services/media.service';
import { SignalingFacade } from '../../services/signaling/signaling.facade';
import { UserService } from '../../services/user.service';
import { VideoCallFacade } from '../../services/video/video-call.facade';
import { ZoomAuthService } from '../../services/video/zoom-auth.service';
import { ZoomMeetService } from '../../services/video/zoom-meet.service';
import { CallRoomBase } from './call-room.base';

@Component({
  selector: 'app-zoom-room',
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.css'],
})
export class ZoomRoomComponent extends CallRoomBase {
  constructor(
    route: ActivatedRoute,
    router: Router,
    media: MediaService,
    video: VideoCallFacade,
    signaling: SignalingFacade,
    users: UserService,
    private zoom: ZoomMeetService,
    private zoomAuth: ZoomAuthService
  ) {
    super(route, router, media, video, signaling, users);
  }

  protected async connect(): Promise<void> {
    const host = this.providerHost?.nativeElement;
    if (!host) {
      throw new Error('Zoom host element is missing.');
    }
    const role: 0 | 1 = this.isCaller ? 1 : 0;
    const sessionName = this.video.zoomSessionName(this.currentUserId, this.remoteUserId);
    const auth = await this.zoomAuth.getJoinAuth(sessionName, role, this.currentUserId);
    await this.zoom.join({
      container: host,
      token: auth.token,
      sessionName: auth.sessionName,
      password: this.video.zoomPasscode,
      userName: this.user?.userName || `User ${this.currentUserId}`,
      onLeft: () => {
        if (!this.ending && !this.destroyed) {
          this.endCall().catch(() => undefined);
        }
      },
    });
    this.isLoading = false;
  }

  protected async disconnect(): Promise<void> {
    await this.zoom.hangup();
  }
}
