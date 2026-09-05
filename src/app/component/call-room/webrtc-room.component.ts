import { Component } from '@angular/core';
import { CallRoomBase } from './call-room.base';

@Component({
  selector: 'app-webrtc-room',
  templateUrl: './call-room.component.html',
  styleUrls: ['./call-room.component.css'],
})
export class WebrtcRoomComponent extends CallRoomBase {
  override usesRemoteVideo = true;

  private peer?: RTCPeerConnection;
  private pendingIce: RTCIceCandidate[] = [];
  private pendingOffer?: { sdp: string; from: string };
  private cameraSender?: RTCRtpSender;

  protected async connect(): Promise<void> {
    if (!this.media.getCurrentStream()) {
      const el = this.localVideo?.nativeElement || document.createElement('video');
      await this.media.startPreview(el);
      this.showLocal();
    }

    this.peer = new RTCPeerConnection({ iceServers: this.video.getIceServers() });
    this.media.getCurrentStream()?.getTracks().forEach((track) => {
      const sender = this.peer!.addTrack(track, this.media.getCurrentStream()!);
      if (track.kind === 'video') {
        this.cameraSender = sender;
      }
    });
    this.peer.ontrack = (event) => {
      const remote = this.remoteVideo?.nativeElement;
      if (remote) {
        remote.srcObject = event.streams[0];
      }
    };
    this.peer.onicecandidate = (event) => {
      if (event.candidate && !this.destroyed) {
        this.signaling.sendIceCandidate(this.remoteUserId, event.candidate).catch(() => undefined);
      }
    };

    this.subs.push(
      this.signaling.receiveOffer$.subscribe(async ({ sdp, from }) => {
        if (from !== this.remoteUserId) {
          return;
        }
        if (!this.peer) {
          this.pendingOffer = { sdp, from };
          return;
        }
        await this.takeOffer(sdp);
      }),
      this.signaling.receiveAnswer$.subscribe(async ({ sdp, from }) => {
        if (from !== this.remoteUserId || !this.peer) {
          return;
        }
        await this.peer.setRemoteDescription(JSON.parse(sdp));
        this.flushIce();
      }),
      this.signaling.receiveIceCandidate$.subscribe(({ candidate, from }) => {
        if (from !== this.remoteUserId || !this.peer) {
          return;
        }
        const ice = new RTCIceCandidate(JSON.parse(candidate));
        if (this.peer.remoteDescription) {
          this.peer.addIceCandidate(ice).catch(() => undefined);
        } else {
          this.pendingIce.push(ice);
        }
      })
    );

    this.isLoading = false;
    if (this.pendingOffer) {
      await this.takeOffer(this.pendingOffer.sdp);
      this.pendingOffer = undefined;
    } else if (this.isCaller) {
      const offer = await this.peer.createOffer();
      await this.peer.setLocalDescription(offer);
      await this.signaling.sendOffer(this.remoteUserId, this.peer.localDescription!);
    }
  }

  protected async disconnect(): Promise<void> {
    this.peer?.close();
    this.peer = undefined;
  }

  protected override async onShareStarted(): Promise<void> {
    const screen = this.media.getScreenStream()?.getVideoTracks()[0];
    if (screen && this.cameraSender) {
      await this.cameraSender.replaceTrack(screen);
    }
  }

  protected override async onShareStopped(): Promise<void> {
    const camera = this.media.getCurrentStream()?.getVideoTracks()[0];
    if (camera && this.cameraSender) {
      await this.cameraSender.replaceTrack(camera);
    }
  }

  private async takeOffer(sdp: string): Promise<void> {
    if (!this.peer) {
      return;
    }
    await this.peer.setRemoteDescription(JSON.parse(sdp));
    this.flushIce();
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    await this.signaling.sendAnswer(this.remoteUserId, this.peer.localDescription!);
  }

  private flushIce(): void {
    this.pendingIce.forEach((ice) => this.peer?.addIceCandidate(ice).catch(() => undefined));
    this.pendingIce = [];
  }
}
