import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SignalRService {
  private hubConnection!: signalR.HubConnection;
  incomingCall$ = new Subject<string>(); // callerUserId
  callAccepted$ = new Subject<string>(); // calleeUserId
  receiveOffer$ = new Subject<{ sdp: string; from: string }>();
  receiveAnswer$ = new Subject<{ sdp: string; from: string }>();
  receiveIceCandidate$ = new Subject<{ candidate: string; from: string }>();
  callEnded$ = new Subject<void>();
  private currentUserId: string = '';

  connect(userId: string) {
    this.currentUserId = userId;

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`http://localhost:5202/hubs/chat?userId=${userId}`)
      .withAutomaticReconnect()
      .build();

    this.hubConnection.on('IncomingCall', (caller) => {
      this.incomingCall$.next(caller);
    });
    this.hubConnection.on('CallAccepted', (callee) =>
      this.callAccepted$.next(callee)
    );
    this.hubConnection.on('ReceiveOffer', (sdp, from) =>
      this.receiveOffer$.next({ sdp, from })
    );
    this.hubConnection.on('ReceiveAnswer', (sdp, from) =>
      this.receiveAnswer$.next({ sdp, from })
    );
    this.hubConnection.on('ReceiveIceCandidate', (candidate, from) =>
      this.receiveIceCandidate$.next({ candidate, from })
    );
    this.hubConnection.on('CallEnded', () => this.callEnded$.next());

    this.hubConnection
      .start()
      .then(() => console.log('[SignalR] Connected'))
      .catch((err) => console.error('[SignalR] Connection failed', err));

    this.hubConnection.on('ReceiveMessage', (fromUserId, message) => {
      console.log(`[SignalR] Message from ${fromUserId}: ${message}`);
    });
  }

  sendMessage(toUserId: string, message: string) {
    this.hubConnection
      .invoke('SendMessage', toUserId, message)
      .catch((err) => console.error('[SignalR] Send error', err));
  }
  async initiateCall(callerUserId: string, receiverId: string) {
    await this.hubConnection.invoke('InitiateCall', callerUserId, receiverId);
  }

  async acceptCall(callerUserId: string) {
    await this.hubConnection.invoke('AcceptCall', callerUserId);
  }

  sendOffer(targetId: string, sdp: RTCSessionDescriptionInit) {
    return this.hubConnection.invoke(
      'SendOffer',
      targetId,
      JSON.stringify(sdp),
      this.currentUserId
    );
  }

  sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit) {
    return this.hubConnection.invoke(
      'SendAnswer',
      targetId,
      JSON.stringify(sdp),
      this.currentUserId
    );
  }

  sendIceCandidate(targetId: string, candidate: RTCIceCandidate) {
    return this.hubConnection.invoke(
      'SendIceCandidate',
      targetId,
      JSON.stringify(candidate),
      this.currentUserId
    );
  }

  endCall(targetId: string) {
    return this.hubConnection.invoke('EndCall', targetId, this.currentUserId);
  }
}
