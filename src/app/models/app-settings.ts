export type SignalingProviderId = 'signalr' | 'websocket';
export type VideoProviderId = 'webrtc' | 'zoom' | 'vidyo' | 'jitsi';

export interface AppSettings {
  signalingProvider: SignalingProviderId;
  videoProvider: VideoProviderId;
  backendUrl: string;
  expressUrl: string;
  stunUrl: string;
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
  zoomSdkKey: string;
  zoomSdkSecret: string;
  zoomMeetingNumber: string;
  zoomPasscode: string;
  vidyoHost: string;
  vidyoRoomKey: string;
  vidyoToken: string;
  jitsiDomain: string;
  jitsiRoomPrefix: string;
  jitsiAppId: string;
  jitsiApiKeyId: string;
  jitsiPrivateKey: string;
  jitsiJwt: string;
}

export const BACKEND_URL_CANDIDATES = [
  'https://localhost:44388',
  'http://localhost:21262',
  'https://localhost:7299',
  'http://localhost:5202',
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  signalingProvider: 'signalr',
  videoProvider: 'webrtc',
  backendUrl: 'https://localhost:44388',
  expressUrl: 'http://localhost:3000',
  stunUrl: 'stun:stun.l.google.com:19302',
  turnUrl: '',
  turnUsername: '',
  turnCredential: '',
  zoomSdkKey: '',
  zoomSdkSecret: '',
  zoomMeetingNumber: '',
  zoomPasscode: '',
  vidyoHost: '',
  vidyoRoomKey: '',
  vidyoToken: '',
  jitsiDomain: 'meet.ffmuc.net',
  jitsiRoomPrefix: 'learnlink',
  jitsiAppId: '',
  jitsiApiKeyId: '',
  jitsiPrivateKey: '',
  jitsiJwt: '',
};
