import { Component } from '@angular/core';
import { CallRoomBase } from './call-room.base';

@Component({
  selector: 'app-vidyo-room',
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.css'],
})
export class VidyoRoomComponent extends CallRoomBase {
  protected async connect(): Promise<void> {
    const host = this.providerHost?.nativeElement;
    const url = this.video.getEmbedUrl(this.currentUserId, this.remoteUserId);
    if (!host || !url) {
      throw new Error('Add a Vidyo host in Settings.');
    }
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.allow = 'camera; microphone; fullscreen; display-capture; autoplay';
    host.appendChild(frame);
    this.isLoading = false;
  }

  protected async disconnect(): Promise<void> {
    const host = this.providerHost?.nativeElement;
    if (host) {
      host.innerHTML = '';
    }
  }
}
