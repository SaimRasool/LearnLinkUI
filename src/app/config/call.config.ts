import { SignalingProviderId, VideoProviderId } from '../models/app-settings';

/**
 * Defaults for signaling and video. Settings can override video + Zoom/Jitsi
 * without a rebuild. Signaling still comes from this file — restart ng serve
 * after you change signalingProvider.
 *
 * signalingProvider:
 *   'signalr'   — ASP.NET SignalR hub (recommended)
 *   'websocket' — raw JSON WebSocket on the same API
 *
 * videoProvider:
 *   'webrtc'  — built-in peer-to-peer
 *   'jitsi'   — Jitsi External API. Unique room per pair.
 *   'zoom'    — Zoom Video SDK. Unique session per pair (learnlink-{id}-{id}).
 *   'vidyo'   — iframe join only
 *
 * --- Jitsi ---
 *
 * A) No account: domain 'meet.ffmuc.net', leave JaaS fields empty.
 * B) 8x8 JaaS: domain '8x8.vc' plus appId / apiKeyId / PKCS#8 private key.
 * C) Self-hosted: set domain to your Jitsi host.
 *
 * --- Zoom Video SDK ---
 *
 * 1. Create a Video SDK app at https://marketplace.zoom.us/ (not Meeting SDK)
 * 2. Copy SDK Key and SDK Secret
 * 3. Paste them in Settings, or set Zoom:ClientId / Zoom:ClientSecret on LearnLink API
 * 4. Optional session passcode (max 10 characters) — both users must use the same one
 *
 * No Zoom meeting number is needed. Ali calling Haris joins session learnlink-1-2.
 */
export const CALL_CONFIG = {
  signalingProvider: 'signalr' as SignalingProviderId,
  backendUrl: 'https://localhost:44388',
  videoProvider: 'webrtc' as VideoProviderId,

  jitsi: {
    domain: 'meet.ffmuc.net',
    roomPrefix: 'learnlink',
    appId: '',
    apiKeyId: '',
    privateKey: '',
    jwt: '',
  },

  zoom: {
    meetingNumber: '',
    passcode: '',
    sdkKey: '',
    sdkSecret: '',
  },

  vidyo: {
    host: '',
    roomKey: '',
    token: '',
  },
};
