import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { AppSettingsService } from '../app-settings.service';
import { BackendLocatorService } from '../backend-locator.service';
import { SignalRService } from '../signalR.service';
import { WebsocketService } from '../websocket.service';
import { TabSignalingService } from './tab-signaling.service';
import {
  CallAcceptedEvent,
  CallEndedEvent,
  ChatMessageEvent,
  ConnectionState,
  IceEvent,
  IncomingCallEvent,
  ISignalingService,
  SdpEvent,
} from './signaling.types';

@Injectable({ providedIn: 'root' })
export class SignalingFacade implements ISignalingService {
  incomingCall$ = new Subject<IncomingCallEvent>();
  callAccepted$ = new Subject<CallAcceptedEvent>();
  receiveOffer$ = new Subject<SdpEvent>();
  receiveAnswer$ = new Subject<SdpEvent>();
  receiveIceCandidate$ = new Subject<IceEvent>();
  callEnded$ = new Subject<CallEndedEvent>();
  receiveMessage$ = new Subject<ChatMessageEvent>();
  connectionState$ = new BehaviorSubject<ConnectionState>('closed');
  transportLabel$ = new BehaviorSubject('closed');
  lastError = '';

  private pipes: Subscription[] = [];
  private connectedUserId?: string;
  private connectInFlight?: Promise<void>;
  private generation = 0;
  private applyingBackend = false;

  constructor(
    private settings: AppSettingsService,
    private locator: BackendLocatorService,
    private signalR: SignalRService,
    private websocket: WebsocketService,
    private tabs: TabSignalingService
  ) {
    this.bindActive();
    let previousProvider = this.settings.signalingProvider;
    let previousBackend = this.settings.current.backendUrl;
    this.settings.settings$.subscribe((settings) => {
      const providerChanged = settings.signalingProvider !== previousProvider;
      const backendChanged = settings.backendUrl !== previousBackend;
      previousProvider = settings.signalingProvider;
      previousBackend = settings.backendUrl;
      this.bindActive();
      if (
        this.connectedUserId &&
        !this.applyingBackend &&
        (providerChanged || backendChanged)
      ) {
        this.connect(this.connectedUserId).catch((err) =>
          console.error('[Signaling] Reconnect after settings change failed', err)
        );
      }
    });
  }

  get activeProvider(): 'signalr' | 'websocket' {
    return this.settings.signalingProvider;
  }

  get isOpen(): boolean {
    return this.connectionState$.value === 'open';
  }

  get transportLabel(): string {
    return this.transportLabel$.value;
  }

  async connect(userId: string): Promise<void> {
    const myGeneration = ++this.generation;
    this.connectedUserId = userId;
    this.tabs.connect(userId);
    this.markOpen('Local tabs');
    if (this.connectInFlight) {
      await this.connectInFlight.catch(() => undefined);
      if (myGeneration !== this.generation) {
        return;
      }
    }

    this.connectInFlight = this.connectRemote(userId, myGeneration).finally(() => {
      this.connectInFlight = undefined;
    });
    await this.connectInFlight;
  }

  private async connectRemote(userId: string, generation: number): Promise<void> {
    const reachable = await this.locator.listReachable();
    const urls = reachable.length ? reachable : this.locator.candidateUrls();
    this.lastError = '';

    for (const url of urls) {
      if (generation !== this.generation) {
        return;
      }
      try {
        this.applyingBackend = true;
        if (url !== this.settings.current.backendUrl) {
          this.settings.update({ backendUrl: url });
        }
        await this.inactive.disconnect();
        await this.active.connect(userId, url);
        if (generation !== this.generation) {
          await this.active.disconnect();
          return;
        }
        if (this.activeOpen) {
          this.markOpen(this.activeProvider === 'websocket' ? 'WebSocket' : 'SignalR');
          return;
        }
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        console.warn('[Signaling] Remote connect failed via', url, err);
      } finally {
        this.applyingBackend = false;
      }
    }

    this.markOpen('Local tabs');
  }

  async disconnect(): Promise<void> {
    this.generation++;
    this.connectedUserId = undefined;
    this.tabs.disconnect();
    this.transportLabel$.next('closed');
    this.connectionState$.next('closed');
    await Promise.all([this.signalR.disconnect(), this.websocket.disconnect()]);
  }

  async sendMessage(toUserId: string, fromUserId: string, text: string): Promise<void> {
    this.tabs.sendMessage(toUserId, fromUserId, text);
    await this.tryRemote(() => this.active.sendMessage(toUserId, fromUserId, text));
  }

  async initiateCall(callerUserId: string, receiverId: string): Promise<void> {
    this.tabs.initiateCall(callerUserId, receiverId);
    await this.tryRemote(() => this.active.initiateCall(callerUserId, receiverId));
  }

  async acceptCall(callerUserId: string, calleeUserId: string): Promise<void> {
    this.tabs.acceptCall(callerUserId, calleeUserId);
    await this.tryRemote(() => this.active.acceptCall(callerUserId, calleeUserId));
  }

  async sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.tabs.sendOffer(targetId, sdp);
    await this.tryRemote(() => this.active.sendOffer(targetId, sdp));
  }

  async sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
    this.tabs.sendAnswer(targetId, sdp);
    await this.tryRemote(() => this.active.sendAnswer(targetId, sdp));
  }

  async sendIceCandidate(targetId: string, candidate: RTCIceCandidate): Promise<void> {
    this.tabs.sendIceCandidate(targetId, candidate);
    await this.tryRemote(() => this.active.sendIceCandidate(targetId, candidate));
  }

  async endCall(targetId: string): Promise<void> {
    this.tabs.endCall(targetId);
    await this.tryRemote(() => this.active.endCall(targetId));
  }

  private get active(): ISignalingService {
    return this.settings.signalingProvider === 'websocket'
      ? this.websocket
      : this.signalR;
  }

  private get inactive(): ISignalingService {
    return this.settings.signalingProvider === 'websocket'
      ? this.signalR
      : this.websocket;
  }

  private get activeOpen(): boolean {
    return this.activeProvider === 'websocket'
      ? this.connectionState$.value === 'open'
      : this.signalR.isOpen;
  }

  private markOpen(label: string): void {
    this.transportLabel$.next(label);
    this.connectionState$.next('open');
  }

  private async tryRemote(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      // Local tab signaling already delivered the event.
    }
  }

  private bindActive(): void {
    this.pipes.forEach((s) => s.unsubscribe());
    this.pipes = [];

    this.pipes.push(
      this.active.connectionState$.subscribe((state) => {
        if (state === 'open') {
          this.markOpen(this.activeProvider === 'websocket' ? 'WebSocket' : 'SignalR');
        } else if (this.tabs.isOpen) {
          this.markOpen('Local tabs');
        } else {
          this.transportLabel$.next(state);
          this.connectionState$.next(state);
        }
      }),
      this.active.incomingCall$.subscribe((e) => this.incomingCall$.next(e)),
      this.active.callAccepted$.subscribe((e) => this.callAccepted$.next(e)),
      this.active.receiveOffer$.subscribe((e) => this.receiveOffer$.next(e)),
      this.active.receiveAnswer$.subscribe((e) => this.receiveAnswer$.next(e)),
      this.active.receiveIceCandidate$.subscribe((e) => this.receiveIceCandidate$.next(e)),
      this.active.callEnded$.subscribe((e) => this.callEnded$.next(e)),
      this.active.receiveMessage$.subscribe((e) => this.receiveMessage$.next(e)),
      this.tabs.incomingCall$.subscribe((e) => this.incomingCall$.next(e)),
      this.tabs.callAccepted$.subscribe((e) => this.callAccepted$.next(e)),
      this.tabs.receiveOffer$.subscribe((e) => this.receiveOffer$.next(e)),
      this.tabs.receiveAnswer$.subscribe((e) => this.receiveAnswer$.next(e)),
      this.tabs.receiveIceCandidate$.subscribe((e) => this.receiveIceCandidate$.next(e)),
      this.tabs.callEnded$.subscribe((e) => this.callEnded$.next(e)),
      this.tabs.receiveMessage$.subscribe((e) => this.receiveMessage$.next(e))
    );
  }
}
