import { Component, HostListener, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MessengerService } from '../../services/messenger.service';
import { UserService } from '../../services/user.service';
import { AlertService } from '../../services/alert.service';
import { UserVM } from '../../models/usersVM';
import { ChannelMessageVM } from '../../models/channelMessageVM';
import { SignalingFacade } from '../../services/signaling/signaling.facade';

@Component({
  selector: 'app-my-messenger',
  templateUrl: './my-messenger.component.html',
  styleUrls: ['./my-messenger.component.css'],
})
export class MyMessengerComponent implements OnChanges, OnInit, OnDestroy {
  user: UserVM | null = null;
  @Input() channel: any | undefined;
  displayMessagesList: any[] = [];
  participantList: any[] = [];
  currentPage = 1;
  pageSize = 20;
  isChannelParticipants = false;
  textareaValue = '';
  sending = false;
  connectionLabel = 'offline';

  private subs: Subscription[] = [];

  constructor(
    private messengerService: MessengerService,
    private accountService: UserService,
    private alertService: AlertService,
    private signaling: SignalingFacade,
    private router: Router
  ) {
    this.accountService.user.subscribe((x) => (this.user = x));
  }

  get messageCount(): number {
    return this.displayMessagesList.length;
  }

  get hasChannel(): boolean {
    return !!this.channel?.channelId;
  }

  startVideoCall(): void {
    const other = (this.participantList || []).find((p) => p.userId != this.user?.userId);
    if (!other?.userId) {
      this.alertService.error('No other participant in this chat');
      return;
    }
    this.router.navigate(['/call', other.userId], { queryParams: { role: 'caller' } });
  }

  get thread(): any[] {
    return this.buildThread(this.displayMessagesList);
  }

  ngOnInit(): void {
    this.subs.push(
      this.signaling.receiveMessage$.subscribe((msg) => {
        if (!this.hasChannel) {
          return;
        }
        const otherIds = this.participantList
          .filter((p) => p.userId != this.user?.userId)
          .map((p) => String(p.userId));
        if (otherIds.includes(String(msg.fromUserId))) {
          this.getNewChannelMessages();
        }
      }),
      this.signaling.connectionState$.subscribe((state) => {
        this.connectionLabel = state === 'open' ? 'online' : state;
      })
    );
  }

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['channel'] && this.hasChannel) {
      this.currentPage = 1;
      this.displayMessagesList = [];
      await this.loadChannelParticipant();
      this.getAllChannelMessages(false);
    }
  }

  async loadChannelParticipant(): Promise<void> {
    this.alertService.clear();
    try {
      this.participantList =
        (await this.messengerService
          .getChannelParticipants(this.channel.channelId)
          .toPromise()) || [];
      this.isChannelParticipants = true;
    } catch (error: any) {
      this.alertService.error(error);
    }
  }

  addMessage(): void {
    const text = this.textareaValue.trim();
    if (!text || !this.user?.userId || this.sending) {
      return;
    }

    const recipients = this.participantList.filter((cp: any) => cp.userId != this.user!.userId);
    const msg = new ChannelMessageVM();
    msg.messageContent = text;
    msg.channelId = this.channel?.channelId;
    msg.isSeen = false;
    msg.messageDate = new Date();
    msg.senderID = this.user.userId;

    this.sending = true;
    this.messengerService.addChannelMessage(msg).subscribe({
      next: (data) => {
        recipients.forEach((user) => {
          this.signaling
            .sendMessage(String(user.userId), String(this.user!.userId), text)
            .catch(() => undefined);
        });
        if (data?.res) {
          this.getNewChannelMessages();
        }
        this.sending = false;
      },
      error: () => {
        this.displayMessagesList.push({
          ...msg,
          isSelf: true,
          image: this.user?.image,
          userName: this.user?.userName,
        });
        recipients.forEach((user) => {
          this.signaling
            .sendMessage(String(user.userId), String(this.user!.userId), text)
            .catch(() => undefined);
        });
        this.alertService.error('Saved in this window only. Start Express on port 3000 to persist.');
        this.moveScrollToBottom();
        this.sending = false;
      },
    });
    this.textareaValue = '';
  }

  @HostListener('scroll', ['$event'])
  onScroll(event: any): void {
    if (event.target.scrollTop === 0 && this.currentPage >= 1 && this.isChannelParticipants) {
      this.currentPage++;
      this.getAllChannelMessages(true);
    }
  }

  moveScrollToBottom(): void {
    setTimeout(() => {
      const element = document.getElementById('messages-flow') as HTMLDivElement | null;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, 20);
  }

  moveScrollToElement(elementId: any): void {
    setTimeout(() => {
      const element = document.getElementById(elementId) as HTMLDivElement | null;
      element?.scrollIntoView();
    }, 20);
  }

  async getAllChannelMessages(olderMessages = false): Promise<void> {
    let lastChannelMessage = 0;
    if (this.currentPage === 1) {
      this.displayMessagesList = [];
    } else if (this.displayMessagesList.length > 0) {
      lastChannelMessage = this.displayMessagesList[0].channelMessageId;
    }

    try {
      const response = await this.messengerService
        .getChannelMessages(this.channel.channelId, this.currentPage, this.pageSize)
        .toPromise();
      if (!response?.length) {
        return;
      }
      const mapped = response.map((element: any) => this.decorateMessage(element));
      if (olderMessages) {
        this.displayMessagesList = [...mapped.reverse(), ...this.displayMessagesList];
        this.moveScrollToElement('dvmessage_' + lastChannelMessage);
      } else {
        this.displayMessagesList = mapped.reverse();
        this.moveScrollToBottom();
      }
    } catch (error: any) {
      this.alertService.error(error);
    }
  }

  getNewChannelMessages(): void {
    const lastChannelMessage =
      this.displayMessagesList[this.displayMessagesList.length - 1]?.channelMessageId || 0;
    this.messengerService
      .getNewChannelMessages(this.channel.channelId, lastChannelMessage)
      .subscribe({
        next: (response) => {
          if (!response?.length) {
            return;
          }
          const existing = new Set(this.displayMessagesList.map((m) => m.channelMessageId));
          response.forEach((element: any) => {
            if (!existing.has(element.channelMessageId)) {
              this.displayMessagesList.push(this.decorateMessage(element));
            }
          });
          this.moveScrollToBottom();
        },
        error: (error) => this.alertService.error(error),
      });
  }

  handleKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.addMessage();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private decorateMessage(element: any): any {
    const user = this.participantList.find((cp: any) => cp.userId == element.senderID);
    return {
      ...element,
      ...user,
      isSelf: element.senderID == this.user?.userId,
    };
  }

  private buildThread(messages: any[]): any[] {
    const items: any[] = [];
    let lastDay = '';

    messages.forEach((msg, index) => {
      const day = this.dayKey(msg.messageDate);
      if (day !== lastDay) {
        items.push({ kind: 'day', label: this.dayLabel(msg.messageDate) });
        lastDay = day;
      }

      const prev = messages[index - 1];
      const next = messages[index + 1];
      const samePrev = this.isSameGroup(prev, msg);
      const sameNext = this.isSameGroup(msg, next);

      items.push({
        kind: 'message',
        ...msg,
        isFirst: !samePrev,
        isLast: !sameNext,
        clustered: samePrev,
        showAvatar: !msg.isSelf && !sameNext,
      });
    });

    return items;
  }

  private isSameGroup(a: any, b: any): boolean {
    if (!a || !b || a.senderID !== b.senderID) {
      return false;
    }
    const first = new Date(a.messageDate).getTime();
    const second = new Date(b.messageDate).getTime();
    return Math.abs(second - first) <= 5 * 60 * 1000 && this.dayKey(a.messageDate) === this.dayKey(b.messageDate);
  }

  private dayKey(value: string | Date): string {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  private dayLabel(value: string | Date): string {
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (this.dayKey(date) === this.dayKey(today)) {
      return 'Today';
    }
    if (this.dayKey(date) === this.dayKey(yesterday)) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    });
  }
}
