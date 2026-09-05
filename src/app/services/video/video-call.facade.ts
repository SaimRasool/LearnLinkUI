import { Injectable } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AppSettingsService } from '../app-settings.service';
import { VideoProviderId } from '../../models/app-settings';
import { createJitsiJwt } from './jitsi-jwt';

export interface VideoProviderOption {
  id: VideoProviderId;
  name: string;
  description: string;
  needsCredentials: boolean;
  screenShare: boolean;
  recording: boolean;
}

@Injectable({ providedIn: 'root' })
export class VideoCallFacade {
  readonly providers: VideoProviderOption[] = [
    {
      id: 'webrtc',
      name: 'WebRTC (default)',
      description: 'Peer-to-peer video through your own signaling server.',
      needsCredentials: false,
      screenShare: true,
      recording: true,
    },
    {
      id: 'jitsi',
      name: 'Jitsi Meet SDK',
      description: 'Official Jitsi External API. Each pair gets a unique room. Works without keys on meet.ffmuc.net.',
      needsCredentials: false,
      screenShare: true,
      recording: false,
    },
    {
      id: 'zoom',
      name: 'Zoom Video SDK',
      description: 'Official Zoom Video SDK. Each pair gets a unique session, like Jitsi. Needs SDK Key / Secret.',
      needsCredentials: true,
      screenShare: false,
      recording: false,
    },
    {
      id: 'vidyo',
      name: 'Vidyo',
      description: 'Join a Vidyo room. Add host / room / token in Settings.',
      needsCredentials: true,
      screenShare: false,
      recording: true,
    },
  ];

  constructor(
    private settings: AppSettingsService,
    private sanitizer: DomSanitizer
  ) {}

  get provider(): VideoProviderId {
    return this.settings.videoProvider;
  }

  get zoomPasscode(): string {
    return (this.settings.current.zoomPasscode || '').slice(0, 10);
  }

  zoomSessionName(localUserId: string, remoteUserId: string): string {
    return this.sessionId(localUserId, remoteUserId);
  }

  getProviderMeta(id: VideoProviderId = this.provider): VideoProviderOption {
    return this.providers.find((p) => p.id === id) ?? this.providers[0];
  }

  isNativeWebrtc(): boolean {
    return this.provider === 'webrtc';
  }

  isJitsi(): boolean {
    return this.provider === 'jitsi';
  }

  isZoom(): boolean {
    return this.provider === 'zoom';
  }

  usesLocalPreview(): boolean {
    return true;
  }

  get features(): Pick<VideoProviderOption, 'screenShare' | 'recording'> {
    return this.getProviderMeta();
  }

  isConfigured(id: VideoProviderId = this.provider): boolean {
    const s = this.settings.current;
    switch (id) {
      case 'webrtc':
        return true;
      case 'jitsi':
        return !!this.normalizedJitsiDomain();
      case 'zoom':
        return true;
      case 'vidyo':
        return !!s.vidyoHost;
      default:
        return false;
    }
  }

  sessionId(localUserId: string, remoteUserId: string): string {
    const [a, b] = [localUserId, remoteUserId].map(String).sort();
    return `learnlink-${a}-${b}`;
  }

  jitsiRoomName(localUserId: string, remoteUserId: string): string {
    const prefix = (this.settings.current.jitsiRoomPrefix || 'learnlink').replace(/[^a-zA-Z0-9-_]/g, '');
    const [a, b] = [localUserId, remoteUserId].map(String).sort();
    return `${prefix || 'learnlink'}-${a}-${b}`;
  }

  normalizedJitsiDomain(): string {
    return (this.settings.current.jitsiDomain || 'meet.jit.si')
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();
  }

  async getJitsiJoinConfig(localUserId: string, remoteUserId: string, displayName: string) {
    const s = this.settings.current;
    const name = displayName || `User ${localUserId}`;
    let jwt = s.jitsiJwt || undefined;
    if (!jwt && s.jitsiAppId && s.jitsiApiKeyId && s.jitsiPrivateKey) {
      jwt = await createJitsiJwt({
        appId: s.jitsiAppId,
        apiKeyId: s.jitsiApiKeyId,
        privateKeyPem: s.jitsiPrivateKey,
        roomName: this.jitsiRoomName(localUserId, remoteUserId),
        userId: localUserId,
        displayName: name,
      });
    }
    return {
      domain: this.normalizedJitsiDomain(),
      roomName: this.jitsiRoomName(localUserId, remoteUserId),
      displayName: name,
      jwt,
      appId: s.jitsiAppId || undefined,
    };
  }

  getIceServers(): RTCIceServer[] {
    const s = this.settings.current;
    const servers: RTCIceServer[] = [];
    if (s.stunUrl) {
      servers.push({ urls: s.stunUrl });
    }
    if (s.turnUrl) {
      servers.push({
        urls: s.turnUrl,
        username: s.turnUsername || undefined,
        credential: s.turnCredential || undefined,
      });
    }
    return servers.length ? servers : [{ urls: 'stun:stun.l.google.com:19302' }];
  }

  getEmbedUrl(localUserId: string, remoteUserId: string): string | null {
    const s = this.settings.current;
    const room = this.sessionId(localUserId, remoteUserId);
    const displayName = encodeURIComponent(`User ${localUserId}`);

    switch (this.provider) {
      case 'jitsi': {
        const domain = this.normalizedJitsiDomain();
        const jitsiRoom = this.jitsiRoomName(localUserId, remoteUserId);
        const jwt = s.jitsiJwt ? `?jwt=${encodeURIComponent(s.jitsiJwt)}` : '';
        return `https://${domain}/${s.jitsiAppId ? `${encodeURIComponent(s.jitsiAppId)}/` : ''}${jitsiRoom}${jwt}#userInfo.displayName="${displayName}"&config.prejoinPageEnabled=false`;
      }
      case 'zoom':
        return null;
      case 'vidyo':
        if (!s.vidyoHost) {
          return null;
        }
        const host = s.vidyoHost.replace(/\/$/, '');
        const roomKey = s.vidyoRoomKey || room;
        const token = s.vidyoToken ? `&token=${encodeURIComponent(s.vidyoToken)}` : '';
        return `${host}/join/${encodeURIComponent(roomKey)}?displayName=${displayName}${token}`;
      default:
        return null;
    }
  }

  getSafeEmbedUrl(localUserId: string, remoteUserId: string): SafeResourceUrl | null {
    const url = this.getEmbedUrl(localUserId, remoteUserId);
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }
}
