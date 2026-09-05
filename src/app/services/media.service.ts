import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MediaService {
  audioInputs$ = new BehaviorSubject<MediaDeviceInfo[]>([]);
  audioOutputs$ = new BehaviorSubject<MediaDeviceInfo[]>([]);
  videoDevices$ = new BehaviorSubject<MediaDeviceInfo[]>([]);

  private currentStream?: MediaStream;
  cameraPrivacy = false;
  microphonePrivacy = false;
  micPermission: 'granted' | 'denied' | 'prompt' | undefined;
  camPermission: 'granted' | 'denied' | 'prompt' | undefined;

  async loadDevices(): Promise<void> {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      probe.getTracks().forEach((t) => t.stop());
    } catch {
      // Permission may be denied; labels can still be empty.
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    this.audioInputs$.next(
      this.prependNoneOption(
        'audioinput',
        devices.filter((d) => d.kind === 'audioinput')
      )
    );
    this.audioOutputs$.next(
      this.prependNoneOption(
        'audiooutput',
        devices.filter((d) => d.kind === 'audiooutput')
      )
    );
    this.videoDevices$.next(
      this.prependNoneOption(
        'videoinput',
        devices.filter((d) => d.kind === 'videoinput')
      )
    );
  }

  firstRealDevice(devices: MediaDeviceInfo[] | null | undefined): MediaDeviceInfo | undefined {
    return devices?.find((d) => d.deviceId && d.deviceId !== 'none');
  }

  async startPreview(videoElement: HTMLVideoElement): Promise<MediaStream> {
    await this.stopPreview();
    this.currentStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    videoElement.srcObject = this.currentStream;
    this.cameraPrivacy = false;
    this.microphonePrivacy = false;
    return this.currentStream;
  }

  async stopPreview(): Promise<void> {
    this.currentStream?.getTracks().forEach((t) => t.stop());
    this.currentStream = undefined;
  }

  getCurrentStream(): MediaStream | undefined {
    return this.currentStream;
  }

  async changeCamera(deviceId: string, videoElement: HTMLVideoElement): Promise<void> {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false,
    });
    this.replaceTrack('video', newStream, videoElement);
    this.cameraPrivacy = false;
  }

  async changeMicrophone(deviceId: string): Promise<void> {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false,
    });
    this.replaceTrack('audio', newStream);
    this.microphonePrivacy = false;
  }

  async changeSpeaker(deviceId: string): Promise<void> {
    const videoEl = document.querySelector('video');
    if (videoEl && 'setSinkId' in videoEl) {
      await (videoEl as HTMLVideoElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(
        deviceId
      );
    }
  }

  /** enabled=true means the microphone is on. */
  toggleMic(enabled: boolean): void {
    this.microphonePrivacy = !enabled;
    this.currentStream?.getAudioTracks().forEach((track) => (track.enabled = enabled));
  }

  /** enabled=true means the camera is on. Tracks stay alive so WebRTC senders keep working. */
  toggleCamera(enabled: boolean, videoElement?: HTMLVideoElement): void {
    this.cameraPrivacy = !enabled;
    this.currentStream?.getVideoTracks().forEach((track) => (track.enabled = enabled));
    if (videoElement && this.currentStream) {
      videoElement.srcObject = enabled ? this.currentStream : null;
    }
  }

  async checkPermissions(): Promise<void> {
    if (!navigator.permissions) {
      return;
    }
    try {
      const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
      this.micPermission = mic.state;
      this.camPermission = cam.state;
      mic.onchange = () => this.checkPermissions();
      cam.onchange = () => this.checkPermissions();
    } catch (e) {
      console.warn('Permission check failed', e);
    }
  }

  async refreshPermissions(): Promise<void> {
    await this.checkPermissions();
  }

  async requestPermissions(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      stream.getTracks().forEach((t) => t.stop());
      await this.refreshPermissions();
      await this.loadDevices();
    } catch (err) {
      console.warn('requestPermissions failed or denied', err);
      await this.refreshPermissions();
    }
  }

  async initPermissions(): Promise<void> {
    await this.checkPermissions();
  }

  prependNoneOption(
    kind: 'audioinput' | 'audiooutput' | 'videoinput',
    list: MediaDeviceInfo[]
  ): MediaDeviceInfo[] {
    const noneDevice = {
      deviceId: 'none',
      kind,
      label: 'None',
      groupId: '',
      toJSON: () => ({}),
    } as unknown as MediaDeviceInfo;
    return [noneDevice, ...list];
  }

  private replaceTrack(
    kind: 'audio' | 'video',
    newStream: MediaStream,
    videoElement?: HTMLVideoElement
  ): void {
    const newTrack = newStream.getTracks().find((t) => t.kind === kind);
    const oldTrack = this.currentStream?.getTracks().find((t) => t.kind === kind);

    if (oldTrack) {
      this.currentStream?.removeTrack(oldTrack);
      oldTrack.stop();
    }
    if (newTrack) {
      this.currentStream?.addTrack(newTrack);
    }
    if (videoElement && kind === 'video' && this.currentStream) {
      videoElement.srcObject = this.currentStream;
    }
  }
}
