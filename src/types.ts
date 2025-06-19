export enum CameraState {
  WAITING = "waiting",
  CONNECTED = "connected",
  CLOSED = "closed",
  LOADING = "loading",
  ERROR = "error",
}

export interface CreateCameraResponse {
  camera: {
    code: string;
    qrcode_url: string;
    state: CameraState;
  };
}

export interface UseCameraOptions {
  sessionId: string;
  authToken: string;
  host?: string;
  useHttps?: boolean;
}

export interface CameraImage {
  id: string;
  url: string;
}

export interface UseCameraReturn {
  cameraState: CameraState;
  qrCodeURL: string;
  image: CameraImage | undefined;
  error: string | null;
  initialize: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
  takePicture: () => void;
}
