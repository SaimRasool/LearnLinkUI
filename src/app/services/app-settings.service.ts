import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CALL_CONFIG } from '../config/call.config';
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  SignalingProviderId,
  VideoProviderId,
} from '../models/app-settings';

const STORAGE_KEY = 'learnlink.settings';

const RUNTIME_KEYS: (keyof AppSettings)[] = [
  'backendUrl',
  'expressUrl',
  'stunUrl',
  'turnUrl',
  'turnUsername',
  'turnCredential',
];

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly settingsSubject = new BehaviorSubject<AppSettings>(this.read());
  readonly settings$ = this.settingsSubject.asObservable();

  get current(): AppSettings {
    return this.settingsSubject.value;
  }

  get signalingProvider(): SignalingProviderId {
    return CALL_CONFIG.signalingProvider;
  }

  get videoProvider(): VideoProviderId {
    return CALL_CONFIG.videoProvider;
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const runtime: Partial<AppSettings> = {};
    RUNTIME_KEYS.forEach((key) => {
      if (partial[key] !== undefined) {
        (runtime as any)[key] = partial[key];
      }
    });
    const next = this.withCallConfig({ ...this.current, ...runtime });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.runtimeOnly(next)));
    this.settingsSubject.next(next);
    return next;
  }

  reset(): AppSettings {
    localStorage.removeItem(STORAGE_KEY);
    const next = this.withCallConfig({ ...DEFAULT_APP_SETTINGS });
    this.settingsSubject.next(next);
    return next;
  }

  private read(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : {};
      if (stored.backendUrl === 'http://localhost:21262') {
        stored.backendUrl = CALL_CONFIG.backendUrl;
      }
      return this.withCallConfig({ ...DEFAULT_APP_SETTINGS, ...stored });
    } catch {
      return this.withCallConfig({ ...DEFAULT_APP_SETTINGS });
    }
  }

  private withCallConfig(base: AppSettings): AppSettings {
    return {
      ...base,
      signalingProvider: CALL_CONFIG.signalingProvider,
      videoProvider: CALL_CONFIG.videoProvider,
      backendUrl: base.backendUrl || CALL_CONFIG.backendUrl,
      jitsiDomain: CALL_CONFIG.jitsi.domain,
      jitsiRoomPrefix: CALL_CONFIG.jitsi.roomPrefix,
      jitsiAppId: CALL_CONFIG.jitsi.appId,
      jitsiApiKeyId: CALL_CONFIG.jitsi.apiKeyId,
      jitsiPrivateKey: CALL_CONFIG.jitsi.privateKey,
      jitsiJwt: CALL_CONFIG.jitsi.jwt,
      zoomMeetingNumber: CALL_CONFIG.zoom.meetingNumber,
      zoomPasscode: CALL_CONFIG.zoom.passcode,
      zoomSdkKey: CALL_CONFIG.zoom.sdkKey,
      zoomSdkSecret: CALL_CONFIG.zoom.sdkSecret,
      vidyoHost: CALL_CONFIG.vidyo.host,
      vidyoRoomKey: CALL_CONFIG.vidyo.roomKey,
      vidyoToken: CALL_CONFIG.vidyo.token,
    };
  }

  private runtimeOnly(settings: AppSettings): Partial<AppSettings> {
    const slim: Partial<AppSettings> = {};
    RUNTIME_KEYS.forEach((key) => {
      (slim as any)[key] = settings[key];
    });
    return slim;
  }
}
