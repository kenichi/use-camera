# @poscam/use-camera

A React hook for camera functionality with Phoenix WebSocket integration.

## Installation

```bash
npm install @poscam/use-camera
```

## Peer Dependencies

- `react ^18.0.0`
- `phoenix ^1.7.0`

## Usage

```typescript
import { useCamera, CameraState } from "@poscam/use-camera";

function CameraComponent({ sessionId }: { sessionId: string }) {
  const {
    cameraState,
    qrCodeURL,
    imageURLs,
    isLoading,
    error,
    initialize,
    disconnect,
    retry,
  } = useCamera(sessionId, {
    host: "your-app.com",
    useHttps: true,
  });

  // Initialize camera on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Status: {cameraState}</p>
      {qrCodeURL && <img src={qrCodeURL} alt="QR Code" />}
      {imageURLs.map((url, index) => (
        <img key={index} src={url} alt={`Captured ${index + 1}`} />
      ))}
      <button onClick={retry}>Retry</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

## API

### `useCamera(sessionId, config?)`

#### Parameters

- `sessionId: string` - Unique session identifier
- `config?: CameraHookConfig` - Optional configuration

#### Configuration Options

```typescript
interface CameraHookConfig {
  host?: string; // Default: "poscam.shop"
  useHttps?: boolean; // Default: true
}
```

#### Returns

```typescript
interface UseCameraReturn {
  cameraState: CameraState;
  qrCodeURL: string;
  imageURLs: string[];
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
}
```

#### Camera States

```typescript
enum CameraState {
  WAITING = "waiting",
  CONNECTED = "connected",
  CLOSED = "closed",
}
```

## License

MIT
