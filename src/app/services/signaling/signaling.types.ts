import { Observable } from 'rxjs';

export type ConnectionState = 'connecting' | 'open' | 'closed';

export interface IncomingCallEvent {
  callerUserId: string;
}

export interface CallAcceptedEvent {
  calleeUserId: string;
}

export interface SdpEvent {
  sdp: string;
  from: string;
}

export interface IceEvent {
  candidate: string;
  from: string;
}

export interface CallEndedEvent {
  from?: string;
}

export interface ChatMessageEvent {
  fromUserId: string;
  text: string;
}

export interface ISignalingService {
  readonly connectionState$: Observable<ConnectionState>;
  readonly incomingCall$: Observable<IncomingCallEvent>;
  readonly callAccepted$: Observable<CallAcceptedEvent>;
  readonly receiveOffer$: Observable<SdpEvent>;
  readonly receiveAnswer$: Observable<SdpEvent>;
  readonly receiveIceCandidate$: Observable<IceEvent>;
  readonly callEnded$: Observable<CallEndedEvent>;
  readonly receiveMessage$: Observable<ChatMessageEvent>;

  connect(userId: string, backendUrl?: string): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(toUserId: string, fromUserId: string, text: string): Promise<void>;
  initiateCall(callerUserId: string, receiverId: string): Promise<void>;
  acceptCall(callerUserId: string, calleeUserId: string): Promise<void>;
  sendOffer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void>;
  sendAnswer(targetId: string, sdp: RTCSessionDescriptionInit): Promise<void>;
  sendIceCandidate(targetId: string, candidate: RTCIceCandidate): Promise<void>;
  endCall(targetId: string): Promise<void>;
}
