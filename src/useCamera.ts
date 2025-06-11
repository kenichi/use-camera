import { useState, useEffect, useRef, useCallback } from "react";
import { Channel, Socket } from "phoenix";
import {
  CameraState,
  CreateCameraResponse,
  CameraHookConfig,
  UseCameraReturn,
} from "./types";

export function useCamera(
  sessionId: string,
  config: CameraHookConfig,
): UseCameraReturn {
  const { host = "poscam.shop", useHttps = true, authToken } = config;
  const httpProtocol = useHttps ? "https" : "http";
  const wsProtocol = useHttps ? "wss" : "ws";

  const [cameraState, setCameraState] = useState<CameraState>(
    CameraState.WAITING,
  );
  const [qrCodeURL, setQrCodeURL] = useState("");
  const [imageURLs, setImageURLs] = useState<string[]>([]);
  const [lastImageURL, setLastImageURL] = useState<string | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(false);
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
            setImageURLs((prev) => [...prev, payload.url]);
            setLastImageURL(payload.url);
          });
        })
        .receive("error", (resp) => {
          console.error("channel error:", resp);
          setError(`Channel error: ${resp.reason || "Unknown error"}`);
        });

      socketRef.current = socket;
      channelRef.current = channel;
    },
    [host, wsProtocol],
  );

  const initialize = useCallback(async (): Promise<void> => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);
    setImageURLs([]);
    setLastImageURL(undefined);

    try {
      const response = await fetchCamera();
      setCameraState(response.camera.state);
      setQrCodeURL(response.camera.qrcode_url);

      await initSocket(response.camera.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
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
    imageURLs,
    lastImageURL,
    isLoading,
    error,
    initialize,
    disconnect,
    retry,
    takePicture,
  };
}
