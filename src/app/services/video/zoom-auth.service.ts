import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AppSettingsService } from '../app-settings.service';
import { createZoomVideoJwt } from './zoom-jwt';
import { ZoomTokenResponse } from './zoom.types';

@Injectable({ providedIn: 'root' })
export class ZoomAuthService {
  constructor(private http: HttpClient, private settings: AppSettingsService) {}

  async getJoinAuth(
    sessionName: string,
    role: 0 | 1,
    userIdentity: string
  ): Promise<ZoomTokenResponse> {
    const topic = String(sessionName || '').trim();
    if (!topic) {
      throw new Error('Zoom session name is missing.');
    }

    try {
      const fromApi = await firstValueFrom(
        this.http.post<ZoomTokenResponse>(
          `${this.settings.current.backendUrl.replace(/\/+$/, '')}/api/zoom/token`,
          { sessionName: topic, role, userIdentity }
        )
      );
      if (fromApi?.token) {
        return fromApi;
      }
    } catch {
      // API missing Video SDK secrets — fall back to local signing
    }

    const s = this.settings.current;
    if (!s.zoomSdkKey || !s.zoomSdkSecret) {
      throw new Error(
        'Zoom Video SDK Key and Secret are missing. Add them in Settings, or set Zoom:ClientId / Zoom:ClientSecret on LearnLink API.'
      );
    }

    return {
      sdkKey: s.zoomSdkKey,
      sessionName: topic,
      role,
      token: await createZoomVideoJwt({
        sdkKey: s.zoomSdkKey,
        sdkSecret: s.zoomSdkSecret,
        sessionName: topic,
        role,
        userIdentity,
      }),
    };
  }
}
