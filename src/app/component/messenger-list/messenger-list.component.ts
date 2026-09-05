import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessengerService } from '../../services/messenger.service';
import { UserVM } from '../../models/usersVM';
import { UserService } from '../../services/user.service';
import { AlertService } from '../../services/alert.service';
import { ChannelVM } from '../../models/channelVM';
import { ChannelParticipantVM } from '../../models/channelParticipantVM';

@Component({
  selector: 'app-messenger-list',
  templateUrl: './messenger-list.component.html',
  styleUrls: ['./messenger-list.component.css'],
})
export class MessengerListComponent implements OnInit {
  user: UserVM | null = null;
  channelList: any[] = [];
  selectedChannel?: ChannelVM;
  loggedInUserChannelIds: number[] = [];
  channelParticipantIds: number[] = [];
  isMenuVisible = false;
  userList: UserVM[] = [];
  searchTerm = '';

  constructor(
    private messengerService: MessengerService,
    private accountService: UserService,
    private alertService: AlertService,
    private router: Router
  ) {
    this.accountService.user.subscribe((x) => (this.user = x));
  }

  get filteredChannels(): any[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.channelList;
    }
    return this.channelList.filter((ch) =>
      (ch.channelName || '').toLowerCase().includes(term)
    );
  }

  async ngOnInit(): Promise<void> {
    if (this.user) {
      await this.getUserChannelIds();
    }
  }

  toggle(): void {
    this.isMenuVisible = !this.isMenuVisible;
  }

  async getUserChannelIds(): Promise<void> {
    this.alertService.clear();
    try {
      const data = await this.messengerService.getUserChannels(this.user!.userId!).toPromise();
      const channelParticipants = data || [];
      this.loggedInUserChannelIds = channelParticipants.map(
        (cp: ChannelParticipantVM) => cp.channelId!
      );
      if (this.loggedInUserChannelIds.length > 0) {
        this.loadAllChannel();
      } else {
        this.loadAllUserList();
      }
    } catch (error: any) {
      this.alertService.error(error);
    }
  }

  loadAllChannel(): void {
    this.alertService.clear();
    this.messengerService.getAllChannels(this.loggedInUserChannelIds).subscribe({
      next: (data) => {
        this.channelList = data.map((ch: any) => {
          const cp = (ch.children || []).find((c: any) => c.userId != this.user!.userId);
          return {
            ...ch,
            channelName: cp?.userName || ch.channelName,
            image: cp?.image || ch.image,
            lastMessageContent: ch.lastMessageContent || 'No messages yet',
          };
        });
        this.channelParticipantIds = this.channelList
          .map((ch) => (ch.children || []).find((c: any) => c.userId != this.user!.userId)?.userId)
          .filter((id: number | undefined) => !!id);
        this.loadAllUserList();
      },
      error: (error) => this.alertService.error(error),
    });
  }

  loadAllUserList(): void {
    this.accountService.getAllUser().subscribe({
      next: (data) => {
        this.userList = data.users.filter(
          (us: UserVM) =>
            us.userId != this.user!.userId &&
            !this.channelParticipantIds.includes(us.userId!)
        );
      },
      error: (error) => this.alertService.error(error),
    });
  }

  selectChannel(channel: ChannelVM): void {
    this.channelList = this.channelList.map((ch) => ({
      ...ch,
      isActive: ch.channelId == channel.channelId,
    }));
    this.selectedChannel = channel;
    this.isMenuVisible = false;
  }

  startVideoCall(channel: any, event: MouseEvent): void {
    event.stopPropagation();
    const cp = (channel.children || []).find((c: any) => c.userId != this.user!.userId);
    if (!cp?.userId) {
      this.alertService.error('No other participant in this chat');
      return;
    }
    this.router.navigate(['/call', cp.userId], { queryParams: { role: 'caller' } });
  }

  startChatWith(user: UserVM): void {
    if (!this.user?.userId || !user.userId) {
      return;
    }
    this.messengerService.createDirectChat(this.user.userId, user.userId).subscribe({
      next: async () => {
        this.isMenuVisible = false;
        await this.getUserChannelIds();
        const created = this.channelList.find((ch) =>
          (ch.children || []).some((c: any) => c.userId === user.userId)
        );
        if (created) {
          this.selectChannel(created);
        }
      },
      error: () =>
        this.alertService.error(
          'Could not create chat. Start the Express server on port 3000.'
        ),
    });
  }
}
