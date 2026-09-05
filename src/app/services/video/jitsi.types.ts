export interface JitsiUserInfo {
  displayName?: string;
  email?: string;
}

export interface JitsiMeetOptions {
  roomName: string;
  parentNode: HTMLElement;
  width?: string | number;
  height?: string | number;
  jwt?: string;
  lang?: string;
  userInfo?: JitsiUserInfo;
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

export interface JitsiMeetExternalAPI {
  addListener(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  executeCommand(command: string, ...args: unknown[]): void;
  dispose(): void;
}

export type JitsiMeetExternalAPICtor = new (
  domain: string,
  options: JitsiMeetOptions
) => JitsiMeetExternalAPI;

export interface JitsiJoinRequest {
  container: HTMLElement;
  domain: string;
  roomName: string;
  displayName: string;
  jwt?: string;
  appId?: string;
  onLeft?: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetExternalAPICtor;
  }
}
