import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppSettings, VideoProviderId } from '../../models/app-settings';
import { AppSettingsService } from '../../services/app-settings.service';
import { BackendLocatorService } from '../../services/backend-locator.service';
import { AlertService } from '../../services/alert.service';
import { VideoCallFacade } from '../../services/video/video-call.facade';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  draft!: AppSettings;
  hostPresets = [
    { label: 'IIS Express (HTTPS)', url: 'https://localhost:44388' },
    { label: 'IIS Express (HTTP)', url: 'http://localhost:21262' },
    { label: 'Kestrel (HTTPS)', url: 'https://localhost:7299' },
    { label: 'Kestrel (HTTP)', url: 'http://localhost:5202' },
  ];
  detecting = false;

  constructor(
    public video: VideoCallFacade,
    public settings: AppSettingsService,
    private locator: BackendLocatorService,
    private alertService: AlertService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.draft = { ...this.settings.current };
  }

  selectProvider(id: VideoProviderId): void {
    this.draft.videoProvider = id;
  }

  useHost(url: string): void {
    this.draft.backendUrl = url;
  }

  async detectApi(): Promise<void> {
    this.detecting = true;
    try {
      const url = await this.locator.resolve();
      this.draft.backendUrl = url;
      this.alertService.success(`Found API at ${this.locator.describe(url)}`);
    } catch {
      this.alertService.error(
        'No LearnLink API answered. Start IIS Express or Kestrel, then try again.'
      );
    } finally {
      this.detecting = false;
    }
  }

  save(): void {
    this.settings.update(this.draft);
    this.alertService.success('Call and server settings saved.');
    this.router.navigate(['/messenger']);
  }

  reset(): void {
    this.draft = { ...this.settings.reset() };
    this.alertService.info('Settings reset to defaults.');
  }
}
