import { Component } from '@angular/core';
import { UserVM } from '../models/usersVM';
import { UserService } from '../services/user.service';
import { Router } from '@angular/router';
import { SignalRService } from '../services/signalR.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'chat-room';
  user: UserVM | null = null;
  callerUserId:string|undefined;
  constructor(
    private accountService: UserService,
    private router: Router,
    private signalR: SignalRService
  ) {
    this.accountService.user.subscribe((x) => (this.user = x));
    this.signalR.connect(this.user?.userId!.toString()??"0");
    this.signalR.incomingCall$.subscribe((caller ) => {
      this.callerUserId = caller;
    });
  }

  logout() {
    this.accountService.logout();
    this.router.navigateByUrl('/login?returnUrl=%2F');
  }
  acceptCall() {
    if (!this.callerUserId) return;

    const callerUserId = this.callerUserId;
    this.signalR.acceptCall(callerUserId); // Tell caller "I'm joining"
    this.router.navigate(['/call', callerUserId], { queryParams: { type: 'rac' }}); // Join room
    this.callerUserId = undefined;
  }

  declineCall() {
    if (this.callerUserId) {
      // Optionally notify caller of rejection
      this.signalR.endCall(this.callerUserId);
    }
    this.callerUserId = undefined;
  }
}
