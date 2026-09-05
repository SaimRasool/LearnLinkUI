import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserVM } from '../models/usersVM';
import { UserService } from '../services/user.service';
import { SignalingFacade } from '../services/signaling/signaling.facade';
import { AppSettingsService } from '../services/app-settings.service';
import { VideoCallFacade } from '../services/video/video-call.facade';
import { ConnectionState } from '../services/signaling/signaling.types';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent implements OnDestroy {
  title = 'LearnLink';
  user: UserVM | null = null;
  callerUserId?: string;
  callerName = '';
  callerImage = '';
  connectionState: ConnectionState = 'closed';
  transportLabel = 'closed';
  hideChrome = false;

  private subs: Subscription[] = [];

  constructor(
    private accountService: UserService,
    private router: Router,
    public signaling: SignalingFacade,
    public settings: AppSettingsService,
    public video: VideoCallFacade
  ) {
    this.subs.push(
      this.accountService.user.subscribe((user) => {
        this.user = user;
        if (user?.userId) {
          this.signaling.connect(String(user.userId)).catch((err) =>
            console.error('Signaling connect failed', err)
          );
        } else {
          this.signaling.disconnect().catch(() => undefined);
        }
      }),
      this.signaling.incomingCall$.subscribe(({ callerUserId }) => {
        this.callerUserId = callerUserId;
        this.resolveCaller(callerUserId);
      }),
      this.signaling.connectionState$.subscribe((state) => {
        this.connectionState = state;
        this.transportLabel = this.signaling.transportLabel;
      }),
      this.signaling.transportLabel$.subscribe((label) => {
        this.transportLabel = label;
      }),
      this.router.events.subscribe(() => {
        this.hideChrome = this.router.url.startsWith('/call');
      })
    );
  }

  get signalingLabel(): string {
    return this.transportLabel;
  }

  get videoLabel(): string {
    return this.video.getProviderMeta().name;
  }

  logout(): void {
    this.accountService.logout();
    this.router.navigate(['/login']);
  }

  reconnectSignaling(): void {
    if (!this.user?.userId) {
      return;
    }
    this.signaling.connect(String(this.user.userId)).catch((err) =>
      console.error('Signaling reconnect failed', err)
    );
  }

  acceptCall(): void {
    if (!this.callerUserId || !this.user?.userId) {
      return;
    }

    const callerUserId = this.callerUserId;
    this.signaling
      .acceptCall(callerUserId, String(this.user.userId))
      .catch((err) => console.error('Accept call failed', err));
    this.router.navigate(['/call', callerUserId], {
      queryParams: { role: 'callee', type: 'rac' },
    });
    this.callerUserId = undefined;
  }

  declineCall(): void {
    if (this.callerUserId) {
      this.signaling.endCall(this.callerUserId).catch(() => undefined);
    }
    this.callerUserId = undefined;
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private resolveCaller(callerUserId: string): void {
    this.callerName = `User ${callerUserId}`;
    this.callerImage = '';
    this.accountService.getUser(callerUserId).subscribe({
      next: (user) => {
        this.callerName = user.userName || this.callerName;
        this.callerImage = user.image || '';
      },
      error: () => undefined,
    });
  }
}
