export interface ZoomJoinRequest {
  container: HTMLElement;
  token: string;
  sessionName: string;
  userName: string;
  password?: string;
  onLeft?: () => void;
}

export interface ZoomTokenResponse {
  sdkKey: string;
  sessionName: string;
  token: string;
  role: number;
}

export interface ZoomUiToolkit {
  joinSession(container: HTMLElement, config: Record<string, unknown>): void;
  closeSession(container?: HTMLElement): void;
  destroy(): void;
  onSessionJoined(handler: () => void): void;
  onSessionClosed(handler: () => void): void;
  onSessionDestroyed(handler: () => void): void;
  offSessionJoined?(handler: () => void): void;
  offSessionClosed?(handler: () => void): void;
}
