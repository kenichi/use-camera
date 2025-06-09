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
    takePicture,
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
      {cameraState === CameraState.CONNECTED && (
        <button onClick={takePicture}>Take Picture</button>
      )}
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
  takePicture: () => void;
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

### Functions

#### `initialize()`
Initializes the camera session and WebSocket connection. Creates a new camera with QR code and establishes real-time communication.

#### `disconnect()`
Manually disconnects the WebSocket connection and cleans up resources.

#### `retry()`
Disconnects and re-initializes the camera session. Useful for recovering from errors.

#### `takePicture()`
Triggers a picture capture command that is broadcast to all connected camera devices via WebSocket. This function:

- Only works when `cameraState` is `CameraState.CONNECTED`
- Sends a `'take_picture'` command through the WebSocket channel
- The command is broadcast to all subscribed clients (camera interfaces)
- Camera interfaces can listen for this command to trigger photo capture

**Usage Example:**
```typescript
const { takePicture, cameraState } = useCamera(sessionId);

// Check if camera is connected before taking picture
if (cameraState === CameraState.CONNECTED) {
  takePicture(); // Broadcasts take picture command
}
```

**Note:** This function sends a command to trigger photo capture. The actual photo capturing and image processing happens on the camera device side (browser with camera access).

## License

MIT
