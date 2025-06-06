export enum CameraState {
  WAITING = "waiting",
  CONNECTED = "connected",
  CLOSED = "closed",
}

export interface CreateCameraResponse {
  camera: {
    code: string;
    qrcode_url: string;
    state: CameraState;
  };
}

export interface CameraHookConfig {
  host?: string;
  useHttps?: boolean;
}

export interface UseCameraReturn {
  cameraState: CameraState;
  qrCodeURL: string;
  imageURL: string;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
}