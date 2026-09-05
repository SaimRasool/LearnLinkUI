import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {
  CallAcceptedEvent,
  CallEndedEvent,
  ChatMessageEvent,
  IceEvent,
  IncomingCallEvent,
  SdpEvent,
} from './signaling.types';

interface TabMessage {
  type: string;
  [key: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class TabSignalingService {
  incomingCall$ = new Subject<IncomingCallEvent>();
  callAccepted$ = new Subject<CallAcceptedEvent>();
  receiveOffer$ = new Subject<SdpEvent>();
  receiveAnswer$ = new Subject<SdpEvent>();
  receiveIceCandidate$ = new Subject<IceEvent>();
  callEnded$ = new Subject<CallEndedEvent>();
  receiveMessage$ = new Subject<ChatMessageEvent>();

  private channel?: BroadcastChannel;
  private userId = '';
  private storageHandler?: (event: StorageEvent) => void;

  get isOpen(): boolean {
    return !!this.userId;
  }

  connect(userId: string): void {
    this.disconnect();
    this.userId = userId;

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('learnlink-signaling');
      this.channel.onmessage = (event) => this.dispatch(event.data as TabMessage);
    }

    this.storageHandler = (event: StorageEvent) => {
      if (event.key !== 'learnlink.tab-signal' || !event.newValue) {
        return;
      }
      try {
        this.dispatch(JSON.parse(event.newValue) as TabMessage);
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', this.storageHandler);
    console.log('[Tabs] Ready as', userId);
  }

  disconnect(): void {
    this.userId = '';
    this.channel?.close();
    this.channel = undefined;
    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = undefined;
    }
  }

  sendMessage(toUserId: string, fromUserId: string, text: string): void {
    this.publish({ type: 'message', toUserId, fromUserId, text });
  }

  initiateCall(callerUserId: string, receiverId: string): void {
    this.publish({ type: 'initiateCall', callerUserId, receiverId });
  }

  acceptCall(callerUserId: string, calleeUserId: string): void {
    this.publish({ type: 'acceptCall', callerUserId, calleeUserId });
  }

  sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): void {
    this.publish({ type: 'offer', targetUserId: targetId, sdp: JSON.stringify(sdp), from: this.userId });
  }

  sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): void {
    this.publish({ type: 'answer', targetUserId: targetId, sdp: JSON.stringify(sdp), from: this.userId });
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): void {
    this.publish({
      type: 'ice',
      targetUserId: targetId,
      candidate: JSON.stringify(candidate),
      from: this.userId,
    });
  }

  endCall(targetId: string): void {
    this.publish({ type: 'endCall', targetUserId: targetId, from: this.userId });
  }

  private publish(msg: TabMessage): void {
    this.channel?.postMessage(msg);
    try {
      localStorage.setItem('learnlink.tab-signal', JSON.stringify({ ...msg, _ts: Date.now() }));
    } catch {
      // private mode
    }
  }

  private dispatch(msg: TabMessage): void {
    const to = String(msg['toUserId'] ?? msg['receiverId'] ?? msg['targetUserId'] ?? '');
    if (to && to !== this.userId) {
      return;
    }

    switch (msg.type) {
      case 'initiateCall':
        this.incomingCall$.next({ callerUserId: String(msg['callerUserId'] || '') });
        break;
      case 'acceptCall':
        this.callAccepted$.next({ calleeUserId: String(msg['calleeUserId'] || '') });
        break;
      case 'offer':
        this.receiveOffer$.next({ sdp: String(msg['sdp'] || ''), from: String(msg['from'] || '') });
        break;
      case 'answer':
        this.receiveAnswer$.next({ sdp: String(msg['sdp'] || ''), from: String(msg['from'] || '') });
        break;
      case 'ice':
        this.receiveIceCandidate$.next({
          candidate: String(msg['candidate'] || ''),
          from: String(msg['from'] || ''),
        });
        break;
      case 'endCall':
        this.callEnded$.next({ from: String(msg['from'] || '') });
        break;
      case 'message':
        this.receiveMessage$.next({
          fromUserId: String(msg['fromUserId'] || ''),
          text: String(msg['text'] || ''),
        });
        break;
      default:
        break;
    }
  }
}
