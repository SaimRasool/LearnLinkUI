import { Injectable, NgZone } from '@angular/core';
import { ZoomJoinRequest, ZoomUiToolkit } from './zoom.types';

const ZOOM_UI_VERSION = '2.2.5';
const ZOOM_CSS = `https://source.zoom.us/uitoolkit/${ZOOM_UI_VERSION}/videosdk-ui-toolkit.css`;
const ZOOM_JS = `https://source.zoom.us/uitoolkit/${ZOOM_UI_VERSION}/videosdk-ui-toolkit.min.umd.js`;

@Injectable({ providedIn: 'root' })
export class ZoomMeetService {
  private toolkit: ZoomUiToolkit | null = null;
  private container: HTMLElement | null = null;
  private scriptPromise: Promise<void> | null = null;
  private closedHandler?: () => void;
  private destroyedHandler?: () => void;

  constructor(private zone: NgZone) {}

  get isRunning(): boolean {
    return !!this.toolkit;
  }

  async join(request: ZoomJoinRequest): Promise<void> {
    await this.dispose();
    const toolkit = await this.loadToolkit();
    if (!toolkit?.joinSession) {
      throw new Error('Zoom Video SDK UI Toolkit did not load.');
    }

    this.toolkit = toolkit;
    this.container = request.container;
    this.closedHandler = () => this.zone.run(() => request.onLeft?.());
    this.destroyedHandler = () => {
      try {
        toolkit.destroy();
      } catch {
        // already destroyed
      }
    };
    toolkit.onSessionClosed(this.closedHandler);
    toolkit.onSessionDestroyed(this.destroyedHandler);
    toolkit.joinSession(request.container, {
      videoSDKJWT: request.token,
      sessionName: request.sessionName,
      userName: request.userName,
      sessionPasscode: request.password || '',
    });
  }

  async hangup(): Promise<void> {
    try {
      if (this.toolkit && this.container) {
        this.toolkit.closeSession(this.container);
      }
    } catch {
      // already closed
    }
    await this.dispose();
  }

  async dispose(): Promise<void> {
    if (!this.toolkit) {
      this.container = null;
      return;
    }
    if (this.closedHandler) {
      this.toolkit.offSessionClosed?.(this.closedHandler);
      this.closedHandler = undefined;
    }
    try {
      this.toolkit.destroy();
    } catch {
      // widget already torn down
    }
    this.toolkit = null;
    this.container = null;
  }

  private async loadToolkit(): Promise<ZoomUiToolkit> {
    try {
      const mod = await import('@zoom/videosdk-ui-toolkit');
      const toolkit = (mod as { default?: ZoomUiToolkit }).default;
      if (toolkit?.joinSession) {
        return toolkit;
      }
    } catch {
      // webpack/CDN fallback
    }

    await this.ensureCdnAssets();
    if (!window.UIToolkit?.joinSession) {
      throw new Error('Zoom Video SDK UI Toolkit did not load.');
    }
    return window.UIToolkit;
  }

  private ensureCdnAssets(): Promise<void> {
    if (window.UIToolkit?.joinSession) {
      return Promise.resolve();
    }
    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.ensureStylesheet();
    this.scriptPromise = this.loadScript(ZOOM_JS).catch((err) => {
      this.scriptPromise = null;
      throw err;
    });
    return this.scriptPromise;
  }

  private ensureStylesheet(): void {
    if (document.querySelector(`link[href="${ZOOM_CSS}"]`)) {
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ZOOM_CSS;
    document.head.appendChild(link);
  }

  private loadScript(src: string): Promise<void> {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      return existing.dataset['loaded'] === 'true'
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error(`Could not load ${src}`)));
          });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset['loaded'] = 'true';
        resolve();
      };
      script.onerror = () =>
        reject(new Error(`Could not load Zoom Video SDK UI Toolkit from ${src}`));
      document.head.appendChild(script);
    });
  }
}

declare global {
  interface Window {
    UIToolkit?: ZoomUiToolkit;
  }
}
