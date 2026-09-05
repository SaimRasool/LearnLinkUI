import { Injectable } from '@angular/core';
import { CALL_CONFIG } from '../config/call.config';
import { AppSettingsService } from './app-settings.service';
import { BACKEND_URL_CANDIDATES } from '../models/app-settings';

const IIS_EXPRESS_HTTPS = 'https://localhost:44388';
const IIS_EXPRESS_HTTP = 'http://localhost:21262';

@Injectable({ providedIn: 'root' })
export class BackendLocatorService {
  constructor(private settings: AppSettingsService) {}

  candidateUrls(): string[] {
    const preferred = this.normalize(this.settings.current.backendUrl || CALL_CONFIG.backendUrl);
    return [IIS_EXPRESS_HTTPS, preferred, IIS_EXPRESS_HTTP, ...BACKEND_URL_CANDIDATES]
      .map((url) => this.normalize(url))
      .filter((url, index, list) => url && list.indexOf(url) === index);
  }

  async resolve(): Promise<string> {
    const candidates = this.candidateUrls();
    for (const url of candidates) {
      if (await this.isReachable(url)) {
        return url;
      }
    }
    return candidates[0] || BACKEND_URL_CANDIDATES[0];
  }

  async listReachable(): Promise<string[]> {
    const found: string[] = [];
    for (const url of this.candidateUrls()) {
      if (await this.isReachable(url)) {
        found.push(url);
      }
    }
    return found;
  }

  describe(url: string): string {
    const normalized = this.normalize(url);
    if (normalized === IIS_EXPRESS_HTTPS) {
      return `${normalized} (IIS Express HTTPS — same app as Swagger)`;
    }
    if (normalized === IIS_EXPRESS_HTTP) {
      return `${normalized} (IIS Express HTTP — same process as https://localhost:44388, no certificate)`;
    }
    if (normalized.includes(':7299') || normalized.includes(':5202')) {
      return `${normalized} (Kestrel)`;
    }
    return normalized;
  }

  async ensureBackendUrl(): Promise<string> {
    const resolved = await this.resolve();
    if (resolved !== this.settings.current.backendUrl) {
      this.settings.update({ backendUrl: resolved });
    }
    return resolved;
  }

  private async isReachable(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private normalize(url: string): string {
    return (url || '').trim().replace(/\/+$/, '');
  }
}
