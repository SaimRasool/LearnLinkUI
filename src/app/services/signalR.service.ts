import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
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

@Injectable({ providedIn: 'root' })
export class SignalRService implements ISignalingService {
  incomingCall$ = new Subject<IncomingCallEvent>();
  callAccepted$ = new Subject<CallAcceptedEvent>();
  receiveOffer$ = new Subject<SdpEvent>();
  receiveAnswer$ = new Subject<SdpEvent>();
  receiveIceCandidate$ = new Subject<IceEvent>();
  callEnded$ = new Subject<CallEndedEvent>();
  receiveMessage$ = new Subject<ChatMessageEvent>();
  connectionState$ = new BehaviorSubject<ConnectionState>('closed');

  private hubConnection?: signalR.HubConnection;
  private currentUserId = '';
  private epoch = 0;

  constructor(private settings: AppSettingsService) {}

  get isOpen(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }

  async connect(userId: string, backendUrl?: string): Promise<void> {
    const myEpoch = ++this.epoch;
    await this.stopHub();
    if (myEpoch !== this.epoch) {
      return;
    }

    this.currentUserId = userId;
    this.connectionState$.next('connecting');

    const base = (backendUrl || this.settings.current.backendUrl).replace(/\/+$/, '');
    const hubUrl = `${base}/hubs/chat?userId=${encodeURIComponent(userId)}`;
    const hub = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        withCredentials: false,
        skipNegotiation: false,
        transport:
          signalR.HttpTransportType.WebSockets |
          signalR.HttpTransportType.ServerSentEvents |
          signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this.hubConnection = hub;
    this.registerHandlers();

    hub.onreconnecting(() => {
      if (this.hubConnection === hub) {
        this.connectionState$.next('connecting');
      }
    });
    hub.onreconnected(() => {
      if (this.hubConnection === hub) {
        this.connectionState$.next('open');
      }
    });
    hub.onclose(() => {
      if (this.hubConnection === hub) {
        this.connectionState$.next('closed');
      }
    });

    try {
      await hub.start();
      if (myEpoch !== this.epoch || this.hubConnection !== hub) {
        await hub.stop().catch(() => undefined);
        return;
      }
      this.connectionState$.next('open');
      console.log('[SignalR] Connected as', userId, 'via', hubUrl);
    } catch (err) {
      if (this.hubConnection === hub) {
        this.hubConnection = undefined;
        this.connectionState$.next('closed');
      }
      console.error('[SignalR] Connection failed to', hubUrl, err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.epoch++;
    await this.stopHub();
  }

  private async stopHub(): Promise<void> {
    const hub = this.hubConnection;
    if (!hub) {
      this.connectionState$.next('closed');
      return;
    }

    try {
      await hub.stop();
    } catch (err) {
      console.warn('[SignalR] Stop failed', err);
    } finally {
      if (this.hubConnection === hub) {
        this.hubConnection = undefined;
        this.connectionState$.next('closed');
      }
    }
  }

  async sendMessage(toUserId: string, fromUserId: string, text: string): Promise<void> {
    await this.invoke('SendMessage', toUserId, fromUserId, text);
  }

  async initiateCall(callerUserId: string, receiverId: string): Promise<void> {
    await this.invoke('InitiateCall', callerUserId, receiverId);
  }

  async acceptCall(callerUserId: string, calleeUserId: string): Promise<void> {
    await this.invoke('AcceptCall', callerUserId, calleeUserId);
  }

  async sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.invoke('SendOffer', targetId, JSON.stringify(sdp), this.currentUserId);
  }

  async sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    await this.invoke('SendAnswer', targetId, JSON.stringify(sdp), this.currentUserId);
  }

  async sendIceCandidate(targetId: string, candidate: RTCIceCandidate): Promise<void> {
    await this.invoke(
      'SendIceCandidate',
      targetId,
      JSON.stringify(candidate),
      this.currentUserId
    );
  }

  async endCall(targetId: string): Promise<void> {
    await this.invoke('EndCall', targetId, this.currentUserId);
  }

  private registerHandlers(): void {
    if (!this.hubConnection) {
      return;
    }

    this.hubConnection.on('IncomingCall', (callerUserId: string) => {
      this.incomingCall$.next({ callerUserId });
    });
    this.hubConnection.on('CallAccepted', (calleeUserId: string) => {
      this.callAccepted$.next({ calleeUserId });
    });
    this.hubConnection.on('ReceiveOffer', (sdp: string, from: string) => {
      this.receiveOffer$.next({ sdp, from });
    });
    this.hubConnection.on('ReceiveAnswer', (sdp: string, from: string) => {
      this.receiveAnswer$.next({ sdp, from });
    });
    this.hubConnection.on('ReceiveIceCandidate', (candidate: string, from: string) => {
      this.receiveIceCandidate$.next({ candidate, from });
    });
    this.hubConnection.on('CallEnded', (from?: string) => {
      this.callEnded$.next({ from });
    });
    this.hubConnection.on('ReceiveMessage', (fromUserId: string, text: string) => {
      this.receiveMessage$.next({ fromUserId, text });
    });
  }

  private async invoke(method: string, ...args: unknown[]): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR is not connected');
    }
    await this.hubConnection.invoke(method, ...args);
  }
}
