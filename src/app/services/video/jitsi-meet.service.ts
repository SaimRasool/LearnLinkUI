import { Injectable, NgZone } from '@angular/core';
import { JitsiJoinRequest, JitsiMeetExternalAPI } from './jitsi.types';

@Injectable({ providedIn: 'root' })
export class JitsiMeetService {
  private api: JitsiMeetExternalAPI | null = null;
  private scriptPromise: Promise<void> | null = null;
  private loadedDomain: string | null = null;

  constructor(private zone: NgZone) {}

  get isRunning(): boolean {
    return !!this.api;
  }

  async join(request: JitsiJoinRequest): Promise<void> {
    await this.dispose();
    await this.ensureScript(request.domain);

    const Ctor = window.JitsiMeetExternalAPI;
    if (!Ctor) {
      throw new Error('Jitsi External API did not load.');
    }

    const roomName = request.appId
      ? `${request.appId}/${request.roomName}`
      : request.roomName;

    this.api = new Ctor(request.domain, {
      roomName,
      parentNode: request.container,
      width: '100%',
      height: '100%',
      jwt: request.jwt || undefined,
      userInfo: { displayName: request.displayName },
      configOverwrite: {
        prejoinPageEnabled: false,
        prejoinConfig: { enabled: false },
        enableWelcomePage: false,
        enableLobby: false,
        enableLobbyChat: false,
        requireDisplayName: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        toolbarButtons: [],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        MOBILE_APP_PROMO: false,
        AUTHENTICATION_ENABLE: false,
        TOOLBAR_BUTTONS: [],
      },
    });

    const leave = () => {
      this.zone.run(() => request.onLeft?.());
    };
    this.api.addListener('videoConferenceLeft', leave);
    this.api.addListener('readyToClose', leave);
  }

  command(name: string, ...args: unknown[]): void {
    this.api?.executeCommand(name, ...args);
  }

  async hangup(): Promise<void> {
    try {
      this.api?.executeCommand('hangup');
    } catch {
      // already closed
    }
    await this.dispose();
  }

  async dispose(): Promise<void> {
    if (!this.api) {
      return;
    }
    try {
      this.api.dispose();
    } catch {
      // iframe already removed
    }
    this.api = null;
  }

  private ensureScript(domain: string): Promise<void> {
    if (window.JitsiMeetExternalAPI && this.loadedDomain === domain) {
      return Promise.resolve();
    }

    if (this.scriptPromise && this.loadedDomain === domain) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-jitsi-api="true"]');
      if (existing && window.JitsiMeetExternalAPI) {
        this.loadedDomain = domain;
        resolve();
        return;
      }
      existing?.remove();

      const script = document.createElement('script');
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.dataset['jitsiApi'] = 'true';
      script.onload = () => {
        this.loadedDomain = domain;
        resolve();
      };
      script.onerror = () => {
        this.scriptPromise = null;
        this.loadedDomain = null;
        reject(new Error(`Could not load Jitsi from ${domain}`));
      };
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }
}
