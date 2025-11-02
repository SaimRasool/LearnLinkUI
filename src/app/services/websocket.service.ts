import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, timer } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

interface WsMessage {
  type: string;
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class WebsocketService implements OnDestroy {
  private readonly reconnectDelayMs = 3000;
  private shouldReconnect = true;

  private incoming$ = new Subject<WsMessage>();
  private connectionState$ = new BehaviorSubject<
    'connecting' | 'open' | 'closed'
  >('closed');

  private destroy$ = new Subject<void>();
  private socket!: WebSocket;
  private userId: string = '';
  private messageQueue: WsMessage[] = [];

  constructor() {
    // this.socket.addEventListener('open', () => console.log('Connected!'));
    // this.socket.addEventListener('message', (e) =>
    //   console.log('Message:', e.data)
    // );
    // this.socket.addEventListener('error', (e) => console.error('Error:', e));
    // this.socket.addEventListener('close', (e) => console.warn('Closed:', e));
  }
  /** Initiates WebSocket connection */
  connect(userId: string) {
    this.userId = userId;
    const wsUrl = `ws://localhost:5202/ws?userId=${userId}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log('[WS] Connected');
      this.connectionState$.next('open');
      this.flushQueue(); // ⬅️ send any pending messages
    };

    this.socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.incoming$.next(msg);
    };

    this.socket.onclose = () => {
      console.warn('[WS] Closed');
      this.connectionState$.next('closed');

      if (this.shouldReconnect) {
        console.log(`[WS] Retrying in ${this.reconnectDelayMs / 1000}s...`);
        timer(this.reconnectDelayMs)
          .pipe(takeUntil(this.destroy$))
          .subscribe(() => this.connect(this.userId));
      }
    };

    this.socket.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.socket?.close();
    };
  }

  /** Sends a JSON message safely */
  private send(msg: WsMessage) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg); 
      console.warn('[WS] Tried to send while not open', msg);
    }
  }

  // /** Identify user after connect */
  // identify(userId: number) {
  //   let userString=userId.toString();
  //   localStorage.setItem('userId', userString);
  //   this.send({ type: 'identify', userId:userString });
  // }

  /** Send a poke to another user */
  poke(toUserId: string, message: string = '👋 poke!') {
    this.send({ type: 'message', toUserId, text: message });
  }

  /** Generic custom send */
  sendCustom(type: string, payload: any) {
    this.send({ type, ...payload });
  }

  /** Listen for all messages */
  listenAll(): Observable<WsMessage> {
    return this.incoming$.asObservable();
  }

  /** Listen for specific message type */
  listen(type: string): Observable<WsMessage> {
    return this.incoming$.pipe(filter((m) => m.type === type));
  }

  /** Observable connection state */
  connectionState(): Observable<'connecting' | 'open' | 'closed'> {
    return this.connectionState$.asObservable();
  }
  private flushQueue() {
    if (
      this.messageQueue.length > 0 &&
      this.socket.readyState === WebSocket.OPEN
    ) {
      console.log(`[WS] Flushing ${this.messageQueue.length} queued messages`);
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift()!;
        this.socket.send(JSON.stringify(msg));
      }
    }
  }
  ngOnDestroy() {
    this.shouldReconnect = false;
    this.destroy$.next();
    this.destroy$.complete();
    this.socket?.close();
  }
}