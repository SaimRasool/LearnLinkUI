import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import {
  CallAcceptedEvent,
  CallEndedEvent,
  ChatMessageEvent,
  ConnectionState,
  IceEvent,
  IncomingCallEvent,
  ISignalingService,
  SdpEvent,
} from './signaling/signaling.types';

interface WsMessage {
  type: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService implements ISignalingService {
  incomingCall$ = new Subject<IncomingCallEvent>();
  callAccepted$ = new Subject<CallAcceptedEvent>();
  receiveOffer$ = new Subject<SdpEvent>();
  receiveAnswer$ = new Subject<SdpEvent>();
  receiveIceCandidate$ = new Subject<IceEvent>();
  callEnded$ = new Subject<CallEndedEvent>();
  receiveMessage$ = new Subject<ChatMessageEvent>();
  connectionState$ = new BehaviorSubject<ConnectionState>('closed');

  private socket?: WebSocket;
  private userId = '';
  private shouldReconnect = false;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private messageQueue: WsMessage[] = [];

  constructor(private settings: AppSettingsService) {}

  async connect(userId: string, _backendUrl?: string): Promise<void> {
    this.shouldReconnect = true;
    this.userId = userId;
    this.openSocket();
  }

  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
    this.connectionState$.next('closed');
  }

  async sendMessage(toUserId: string, fromUserId: string, text: string): Promise<void> {
    this.send({ type: 'message', toUserId, fromUserId, text });
  }

  async initiateCall(callerUserId: string, receiverId: string): Promise<void> {
    this.send({ type: 'initiateCall', callerUserId, receiverId });
  }

  async acceptCall(callerUserId: string, calleeUserId: string): Promise<void> {
    this.send({ type: 'acceptCall', callerUserId, calleeUserId });
  }

  async sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.send({
      type: 'offer',
      targetUserId: targetId,
      sdp: JSON.stringify(sdp),
      senderUserId: this.userId,
    });
  }

  async sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.send({
      type: 'answer',
      targetUserId: targetId,
      sdp: JSON.stringify(sdp),
      senderUserId: this.userId,
    });
  }

  async sendIceCandidate(targetId: string, candidate: RTCIceCandidate): Promise<void> {
    this.send({
      type: 'ice',
      targetUserId: targetId,
      candidate: JSON.stringify(candidate),
      senderUserId: this.userId,
    });
  }

  async endCall(targetId: string): Promise<void> {
    this.send({ type: 'endCall', targetUserId: targetId, senderUserId: this.userId });
  }

  private openSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.socket.close();
    }

    const wsBase = this.settings.current.backendUrl
      .replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:');
    const wsUrl = `${wsBase}/ws?userId=${encodeURIComponent(this.userId)}`;
    this.connectionState$.next('connecting');
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.connectionState$.next('open');
      this.flushQueue();
      console.log('[WS] Connected as', this.userId);
    };

    this.socket.onmessage = (event) => {
      try {
        this.dispatch(JSON.parse(event.data));
      } catch (err) {
        console.error('[WS] Invalid message', err);
      }
    };

    this.socket.onclose = () => {
      this.connectionState$.next('closed');
      if (this.shouldReconnect && this.userId) {
        this.reconnectTimer = setTimeout(() => this.openSocket(), 3000);
      }
    };

    this.socket.onerror = (err) => {
      console.error('[WS] Error', err);
      this.socket?.close();
    };
  }

  private dispatch(msg: WsMessage): void {
    switch (msg.type) {
      case 'incomingCall':
        this.incomingCall$.next({ callerUserId: String(msg['callerUserId'] || '') });
        break;
      case 'callAccepted':
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
      case 'callEnded':
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

  private send(msg: WsMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
      return;
    }
    this.messageQueue.push(msg);
  }

  private flushQueue(): void {
    while (this.messageQueue.length && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(this.messageQueue.shift()));
    }
  }

}
