# LearnLink UI

Angular frontend for **LearnLink** — a practice chat and video-call app. Sign in as a demo user, start a 1:1 conversation, send messages in real time, and place a video call to another user (second browser tab or Incognito works).

This repo is the UI. Real-time signaling lives in the companion API:

**[LearnLinkAPI](https://github.com/SaimRasool/LearnLinkAPI)**

---

## What you can do

| Feature | What it does |
|---|---|
| **Login** | Demo accounts (no server signup). Session is stored per browser tab so two users can run side by side. |
| **Messenger** | Conversation list, search, start a new 1:1 chat, and a threaded message view. |
| **Live messages** | Messages go out over SignalR or WebSocket so the other user sees them immediately. |
| **Incoming call overlay** | Accept or decline a ringing call without leaving the current screen. |
| **Video calls** | WebRTC peer-to-peer, **Jitsi External API**, or **Zoom Video SDK**. |
| **Settings** | Switch video engine, paste Jitsi/Zoom credentials, point at the API, set STUN/TURN. |
| **Connection status** | Header pill shows SignalR/WebSocket state. Click it to reconnect. |

---

## How the pieces fit

```
Browser (this repo)  ──REST──►  Express :3000     persist chats / messages (JSON files)
                     ──hub──►  LearnLink API      SignalR `/hubs/chat` or WebSocket `/ws`
                     ──P2P──►  Other browser      WebRTC media (or Jitsi / Zoom / Vidyo)
```

1. **LearnLinkUI** (this repo) — screens, login, chat UI, call UI.
2. **LearnLinkAPI** — notifies the other user: new message, incoming call, WebRTC offer/answer/ICE, hang-up.
3. **Express** (`express/server.js`) — saves channels, participants, and messages to `src/assets/*.json`. Chat still works without it; messages then stay in the current window only.

---

## Screens

| Route | Purpose |
|---|---|
| `/login` | Sign in. Quick-fill chips for demo users. |
| `/messenger` | Chat list + conversation (default after login). |
| `/settings` | API URL, Express URL, STUN/TURN. |
| `/call/:userId` | Video call with that user. |

---

## Run locally

**Need:** Node.js 18+, the [LearnLinkAPI](https://github.com/SaimRasool/LearnLinkAPI) running, and (optional) Express for saved chats.

```bash
npm install
npm start
```

UI: [http://localhost:4200](http://localhost:4200)

Persist chats (optional):

```bash
cd express
npm install
node server.js
```

Express listens on **http://localhost:3000**.

Start **LearnLinkAPI** in Visual Studio (IIS Express) or with `dotnet run`. Typical URLs:

| Host | URL |
|---|---|
| IIS Express HTTPS (default in Settings) | `https://localhost:44388` |
| IIS Express HTTP | `http://localhost:21262` |
| Kestrel HTTPS | `https://localhost:7299` |
| Kestrel HTTP | `http://localhost:5202` |

Settings → **Detect running API** if you are not sure which one is up.

### Try two users

1. Open `http://localhost:4200` and sign in as **Ali**.
2. Open a second tab (or Incognito) and sign in as **Haris**.
3. Start a chat, send a message, then use the video button.

Demo password for the quick users: `123456`.

---

## Call and signaling config

Edit `src/app/config/call.config.ts`, then restart `ng serve`. Both users must use the same signaling transport and video provider.

| Setting | Options |
|---|---|
| `signalingProvider` | `signalr` (recommended) or `websocket` |
| `videoProvider` | `webrtc` (default), `jitsi`, `zoom`, `vidyo` |
| `backendUrl` | LearnLink API base URL |

You can also switch **Jitsi** / **Zoom** in Settings without editing this file.

### Jitsi Meet SDK

Uses the official External API. Each pair gets a unique room. Public `meet.ffmuc.net` works with empty keys. For 8x8 JaaS, set domain `8x8.vc` and paste App ID + PKCS#8 key.

### Zoom Video SDK

Official Zoom Video SDK (UI Toolkit from Zoom’s CDN). Each pair joins a unique session `learnlink-{id}-{id}` — no Zoom meeting number.

1. Create a **Video SDK** app at [marketplace.zoom.us](https://marketplace.zoom.us/) (not Meeting SDK).
2. Copy **SDK Key** and **SDK Secret**.
3. Paste them in Settings, or set `Zoom:ClientId` / `Zoom:ClientSecret` on LearnLink API.
4. The UI calls `POST /api/zoom/token`. If the API is not configured, the UI signs locally for development.

The caller joins as host (`role_type: 1`). Optional session passcode is max 10 characters and must match on both sides.

WebRTC uses Google STUN by default. Add a TURN server in Settings if calls fail behind a strict firewall.

---

## Project layout

```
src/app/component/     login, messenger, settings, call grid / room
src/app/services/      users, chats, SignalR / WebSocket, WebRTC / Jitsi
src/app/config/        call.config.ts
src/assets/            demo users and JSON chat data
express/               small Node API that writes those JSON files
```

Built with **Angular 16** and **@microsoft/signalr**.

---

## Related repo

- UI (this repo): [github.com/SaimRasool/LearnLinkUI](https://github.com/SaimRasool/LearnLinkUI)
- API: [github.com/SaimRasool/LearnLinkAPI](https://github.com/SaimRasool/LearnLinkAPI)
