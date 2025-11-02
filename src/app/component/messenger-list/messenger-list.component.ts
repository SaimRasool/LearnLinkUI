import { Component, OnInit } from '@angular/core';
import { MessengerService } from '../../services/messenger.service';
import { UserVM } from '../../models/usersVM';
import { UserService } from '../../services/user.service';
import { AlertService } from '../../services/alert.service';
import { ChannelVM } from '../../models/channelVM';
import { ChannelParticipantVM } from '../../models/channelParticipantVM';
import { Router } from '@angular/router';

@Component({
  selector: 'app-messenger-list',
  templateUrl: './messenger-list.component.html',
  styleUrls: ['./messenger-list.component.css'],
})
export class MessengerListComponent implements OnInit {
  user: UserVM | null = null;
  channelList: any[] = [];
  selecteChannel: ChannelVM = new ChannelVM();
  logedInUserChannelIds: number[] = [];
  ChannelParticipantIds: number[] = [];
  isMenuVisible = false;
  userList: UserVM[] = [];
  targetCalleeId:string|undefined;
  constructor(
    private messengerService: MessengerService,
    private accountService: UserService,
    private alertService: AlertService,
    private router: Router,
  ) {
    this.accountService.user.subscribe((x) => (this.user = x));
  }

  async ngOnInit() {
    if (this.user) {
      await this.getUserChannelIds();
    }
  }

  toggle() {
    this.isMenuVisible = !this.isMenuVisible;
  }

  async getUserChannelIds() {
    this.alertService.clear();
    await this.messengerService
      .getUserChannels(this.user!.userId!)
      .toPromise()
      .then(
        (data) => {
          const channelParticipants = data;
          this.logedInUserChannelIds = channelParticipants.map(
            (cp: ChannelParticipantVM) => cp.channelId
          );
          if (this.logedInUserChannelIds.length > 0) {
            this.loadAllChannel();
          }
        },
        (error) => {
          this.alertService.error(error);
        }
      );
  }

  loadAllChannel() {
    this.alertService.clear();
    if (this.logedInUserChannelIds.length > 0)
      this.messengerService
        .getAllChannels(this.logedInUserChannelIds)
        .subscribe(
          (data) => {
            this.channelList = data;
            for (var ch of this.channelList) {
              var cp = ch.children.find(
                (cp: any) => cp.userId != this.user!.userId
              );
              ch.channelName = cp.userName;
              ch.image = cp.image;
              this.ChannelParticipantIds.push(cp.userId);
            }
            this.loadAllUserList();
          },
          (error) => {
            this.alertService.error(error);
          }
        );
  }

  loadAllUserList() {
    this.alertService.clear();
    this.accountService.getAllUser().subscribe(
      (data) => {
        this.userList = data.users.filter(
          (us: UserVM) =>
            us.userId != this.user!.userId &&
            !this.ChannelParticipantIds.includes(us.userId!)
        );
      },
      (error) => {
        this.alertService.error(error);
      }
    );
  }

  selectedChannel(channel: ChannelVM) {
    this.channelList = this.channelList.map((ch) => {
      if (ch.channelId == channel.channelId) {
        return { ...ch, isActive: true };
      }
      return { ...ch, isActive: false };
    });
    this.selecteChannel = channel;
  }

  startVideoCall(channel: any, event: MouseEvent) {
    var cp = channel.children.find((cp: any) => cp.userId != this.user!.userId);
    event.stopPropagation();
  //  console.log('Starting call with:', channel.channelName);
    this.targetCalleeId=cp.userId;
    this.router.navigate(['/call', cp.userId]);
  }
}