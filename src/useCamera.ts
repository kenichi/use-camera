import { useState, useEffect, useRef, useCallback } from "react";
import { Channel, Socket } from "phoenix";
import {
  CameraState,
  CreateCameraResponse,
  UseCameraOptions,
  UseCameraReturn,
  CameraImage,
} from "./types";

export function useCamera(options: UseCameraOptions): UseCameraReturn {
  const { sessionId, authToken, host = "poscam.shop", useHttps = true } = options;
  const httpProtocol = useHttps ? "https" : "http";
  const wsProtocol = useHttps ? "wss" : "ws";

  const [cameraState, setCameraState] = useState<CameraState>(
    CameraState.WAITING,
  );
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [image, setImage] = useState<CameraImage | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const channelRef = useRef<Channel | null>(null);

  const fetchCamera = useCallback(async (): Promise<CreateCameraResponse> => {
    const response = await fetch(`${httpProtocol}://${host}/api/cameras`, {
      body: JSON.stringify({ session_id: sessionId }),
      headers: { 
        "content-type": "application/json",
        "authorization": `Bearer ${authToken}`
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch camera: ${response.statusText}`);
    }

    return response.json();
  }, [sessionId, host, httpProtocol, authToken]);

  const initSocket = useCallback(
    async (code: string): Promise<void> => {
      const socket = new Socket(`${wsProtocol}://${host}/socket`, {
        params: { code },
      });
      socket.connect();

      const channel = socket.channel(`camera:channel:${code}`);

      channel
        .join()
        .receive("ok", (_resp) => {
          channel.on("state", (payload) => setCameraState(payload.state));
          channel.on("image_url", (payload) => {
            setImage({ id: payload.id, url: payload.url });
          });
        })
        .receive("error", (resp) => {
          console.error("channel error:", resp);
          setCameraState(CameraState.ERROR);
          setError(`Channel error: ${resp.reason || "Unknown error"}`);
        });

      socketRef.current = socket;
      channelRef.current = channel;
    },
    [host, wsProtocol],
  );

  const initialize = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    setCameraState(CameraState.LOADING);
    setError(null);
    setImage(undefined);

    try {
      const response = await fetchCamera();
      setCameraState(response.camera.state);
      setQrCodeURL(response.camera.qrcode_url);

      await initSocket(response.camera.code);
    } catch (err) {
      setCameraState(CameraState.ERROR);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    }
  }, [sessionId, fetchCamera, initSocket]);

  const disconnect = useCallback((): void => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      channelRef.current = null;
    }
  }, []);

  const retry = useCallback(async (): Promise<void> => {
    disconnect();
    await initialize();
  }, [disconnect, initialize]);

  const takePicture = useCallback((): void => {
    if (channelRef.current && cameraState === CameraState.CONNECTED) {
      channelRef.current.push("take_picture", {});
    }
  }, [cameraState]);

  useEffect(() => {
    if (cameraState === CameraState.CLOSED) {
      if (socketRef.current) {
        disconnect();
      }
    }
  }, [cameraState, disconnect]);

  return {
    cameraState,
    qrCodeURL,
    image,
    error,
    initialize,
    disconnect,
    retry,
    takePicture,
  };
}
