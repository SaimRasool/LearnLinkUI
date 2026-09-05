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
  /** Load all available devices */
  async loadDevices() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch {
      // ignore if permission denied — we still enumerate devices (may be empty labels)
    }
    const devices = await navigator.mediaDevices.enumerateDevices();

    // replace your previous next(...) calls with these lines:
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
  /** Start preview stream */
  async startPreview(videoElement: HTMLVideoElement): Promise<MediaStream> {
    this.currentStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    videoElement.srcObject = this.currentStream;
    return this.currentStream;
  }

  async stopPreview() {
   await this.currentStream?.getTracks().forEach((t) => t.stop());
  }

  async changeCamera(deviceId: string, videoElement: HTMLVideoElement) {
    const constraints = {
      video: { deviceId: { exact: deviceId } },
      audio: false,
    };
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.replaceTrack('video', newStream, videoElement);
  }

  async changeMicrophone(deviceId: string) {
    const constraints = {
      audio: { deviceId: { exact: deviceId } },
      video: false,
    };
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    this.replaceTrack('audio', newStream);
  }

  async changeSpeaker(deviceId: string) {
    // NOTE: Only supported in Chrome-based browsers
    const videoEl = document.querySelector('video');
    if (videoEl && 'setSinkId' in videoEl) {
      // @ts-ignore
      await videoEl.setSinkId(deviceId);
    }
  }

  toggleMic(enable: boolean) {
    this.microphonePrivacy = enable;
    this.currentStream
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = enable));
  }

  toggleCamera(enable: boolean, videoElement: HTMLVideoElement) {
    this.cameraPrivacy = enable;
    this.currentStream
      ?.getVideoTracks()
      .forEach((track) => (track.enabled = enable));
    // Stop sending video when off (optional)
    if (enable) {
      this.currentStream?.getVideoTracks().forEach((t) => t.stop());
      videoElement.srcObject = null;
    } else {
      // Restart camera
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          const videoTrack = stream.getVideoTracks()[0];
          this.currentStream?.addTrack(videoTrack);
          videoElement.srcObject = this.currentStream!;
        })
        .catch((err) => console.error('Failed to restart camera:', err));
    }
  }

  private replaceTrack(
    kind: 'audio' | 'video',
    newStream: MediaStream,
    videoElement?: HTMLVideoElement
  ) {
    const newTrack = newStream.getTracks().find((t) => t.kind === kind);
    const oldTrack = this.currentStream
      ?.getTracks()
      .find((t) => t.kind === kind);

    if (oldTrack) {
      this.currentStream?.removeTrack(oldTrack);
      oldTrack.stop();
    }
    if (newTrack) {
      this.currentStream?.addTrack(newTrack);
    }
    if (videoElement && kind === 'video') {
      videoElement.srcObject = this.currentStream!;
    }
  }
  /** Check current mic/cam permissions */
  async checkPermissions() {
    if (!navigator.permissions) return;
    try {
      const mic = await navigator.permissions.query({
        name: 'microphone' as PermissionName,
      });
      const cam = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      this.micPermission = mic.state;
      this.camPermission = cam.state;
      mic.onchange = () => this.checkPermissions(); // auto update when user changes permission
      cam.onchange = () => this.checkPermissions();
    } catch (e) {
      console.warn('Permission check failed', e);
    }
  }

  /** Request mic/cam permission again */
  async refreshPermissions() {
    if (!('permissions' in navigator)) return;
    try {
      const micPerm = await (navigator as any).permissions.query({
        name: 'microphone' as PermissionName,
      });
      const camPerm = await (navigator as any).permissions.query({
        name: 'camera' as PermissionName,
      });

      // store the states on your service
      this.micPermission = micPerm.state as
        | 'granted'
        | 'denied'
        | 'prompt'
        | undefined;
      this.camPermission = camPerm.state as
        | 'granted'
        | 'denied'
        | 'prompt'
        | undefined;

      // update privacy flags so UI auto-updates
      this.microphonePrivacy = this.micPermission !== 'granted';
      this.cameraPrivacy = this.camPermission !== 'granted';

      // when the user changes permission in browser, refresh again
      micPerm.onchange = () => this.refreshPermissions().catch(() => {});
      camPerm.onchange = () => this.refreshPermissions().catch(() => {});
    } catch (e) {
      // some browsers may throw — ignore safely
      console.warn('refreshPermissions: not supported or failed', e);
    }
  }

  /** Try to request both audio+video permissions again */
  async requestPermissions() {
    try {
      // this will prompt browser if permission not yet granted
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      // if granted, stop the acquired tracks and refresh state
      stream.getTracks().forEach((t) => t.stop());
      await this.refreshPermissions();
      // optionally reload device list
      await this.loadDevices();
    } catch (err) {
      console.warn('requestPermissions failed or denied', err);
      await this.refreshPermissions();
    }
  }

  /** Called on load to check & handle denied permissions */
  async initPermissions() {
    await this.checkPermissions();
    if (this.micPermission === 'denied' || this.camPermission === 'denied') {
      console.warn('Permissions denied for mic or camera');
    }
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
  getDeviceType(device: MediaDeviceInfo): 'internal' | 'external' | 'virtual' {
    const label = (device.label || '').toLowerCase();
    if (label.includes('virtual') || label.includes('software'))
      return 'virtual';
    if (label.includes('usb') || label.includes('external')) return 'external';
    return 'internal';
  }

  /** Sort devices: None → Internal → External → Virtual */
  sortDevices(devices: MediaDeviceInfo[]): MediaDeviceInfo[] {
    const order = { none: 0, internal: 1, external: 2, virtual: 3 };
    return [...devices].sort((a, b) => {
      const typeA = a.deviceId === 'none' ? 'none' : this.getDeviceType(a);
      const typeB = b.deviceId === 'none' ? 'none' : this.getDeviceType(b);
      return order[typeA] - order[typeB];
    });
  }
}
