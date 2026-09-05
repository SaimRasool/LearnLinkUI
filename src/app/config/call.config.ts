import { SignalingProviderId, VideoProviderId } from '../models/app-settings';

/**
 * Edit this file, then restart `ng serve`.
 * Every user uses the same video engine and the same signaling transport.
 *
 * signalingProvider:
 *   'signalr'   — ASP.NET SignalR hub (recommended)
 *   'websocket' — raw JSON WebSocket on the same API
 *
 * videoProvider:
 *   'jitsi'   — Jitsi Meet (recommended now)
 *   'zoom'    — later; fill zoom.* first
 *   'webrtc'  — built-in peer-to-peer
 *   'vidyo'   — later
 *
 * backendUrl — Communication API. IIS Express in Visual Studio is usually:
 *   https://localhost:44388   (Swagger)
 *   http://localhost:21262    (same process, HTTP — no certificate)
 *
 * --- Free Jitsi options ---
 *
 * A) No account (works today)
 *    domain: 'meet.ffmuc.net'
 *    leave appId / apiKeyId / privateKey / jwt empty
 *
 * B) Official 8x8 JaaS (free Developer plan, API keys + JWT)
 *    1. Open https://jaas.8x8.vc/ and create a free Developer account
 *    2. Copy AppID (vpaas-magic-cookie-…)
 *    3. API keys → Generate API key pair → download the private key (.pk)
 *    4. Copy the Key ID (kid)
 *    5. Set domain '8x8.vc', paste appId, apiKeyId, and the PEM private key
 *    The app signs a short-lived JWT at join time. Do not commit the private key.
 *
 *    meet.jit.si is not usable in an embed: it forces a moderator login.
 *
 * C) Your own Jitsi server (official / company use, no 8x8 bill)
 *    Install Jitsi on a VM (see the self-host steps). Then only change:
 *      domain: 'meet.yourcompany.com'
 *    Leave appId / apiKeyId / privateKey / jwt empty unless you later enable JWT.
 *    The rest of the Angular/SignalR code stays the same.
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
