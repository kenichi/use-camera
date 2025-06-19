# @poscam/use-camera

[![CI](https://github.com/kenichi/use-camera/actions/workflows/ci.yml/badge.svg)](https://github.com/kenichi/use-camera/actions/workflows/ci.yml)

A React hook for camera functionality with Phoenix WebSocket integration.

## Installation

```bash
npm install @poscam/use-camera
```

## Peer Dependencies

- `react ^18.0.0`
- `phoenix ^1.7.0`

## Authentication

Before using the camera hook, you need to obtain an API token from the PosCam application. API tokens can be created through the user settings page and are required for all API requests.

```typescript
// Example: Getting a token and using it with the hook
const apiToken = "your-api-token-here"; // Obtained from PosCam user settings
const sessionId = "unique-session-identifier"; // Your application's session ID
```

## Usage

```typescript
import { useCamera, CameraState, CameraImage } from "@poscam/use-camera";

function CameraComponent({ sessionId, authToken }: { sessionId: string, authToken: string }) {
  const {
    cameraState,
    qrCodeURL,
    image,
    error,
    initialize,
    disconnect,
    retry,
    takePicture,
  } = useCamera({
    sessionId,
    authToken,
    host: "your-app.com",
    useHttps: true,
  });

  // Initialize camera on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  if (cameraState === CameraState.LOADING) return <div>Loading...</div>;
  if (cameraState === CameraState.ERROR) return <div>Error: {error}</div>;

  return (
    <div>
      <p>Status: {cameraState}</p>
      {qrCodeURL && <img src={qrCodeURL} alt="QR Code" />}
      {image && <img src={image.url} alt="Latest capture" />}
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

### `useCamera(options)`

#### Parameters

```typescript
interface UseCameraOptions {
  sessionId: string;       // Unique session identifier
  authToken: string;       // API authentication token
  host?: string;           // Default: "poscam.shop"
  useHttps?: boolean;      // Default: true
}
```

#### Returns

```typescript
interface UseCameraReturn {
  cameraState: CameraState;
  qrCodeURL: string;
  image: CameraImage | undefined;
  error: string | null;
  initialize: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
  takePicture: () => void;
}
```

#### Image Structure

```typescript
interface CameraImage {
  id: string;    // Unique identifier for the image
  url: string;   // URL to access the image
}
```

#### Camera States

```typescript
enum CameraState {
  WAITING = "waiting",     // Waiting for camera connection
  CONNECTED = "connected", // Camera is connected and ready
  CLOSED = "closed",       // Camera session has been closed
  LOADING = "loading",     // Initializing camera session
  ERROR = "error",         // An error occurred
}
```

**State Flow:**
- `LOADING` → `WAITING` → `CONNECTED` → `CLOSED` (normal flow)
- `LOADING` → `ERROR` (on initialization failure)
- Any state → `ERROR` (on WebSocket errors)

**State Management:**
- Loading state is managed through `CameraState.LOADING` instead of a separate `isLoading` boolean
- Error state is managed through `CameraState.ERROR` with error details available in the `error` property
- Only the most recent image is maintained (`image`), not a full history
- Image data includes both an ID and URL for better tracking and management

### Functions

#### `initialize()`
Initializes the camera session and WebSocket connection. Creates a new camera with QR code and establishes real-time communication. Sets `cameraState` to `LOADING` during initialization, then to the server's state on success or `ERROR` on failure.

#### `disconnect()`
Manually disconnects the WebSocket connection and cleans up resources.

#### `retry()`
Disconnects and re-initializes the camera session. Useful for recovering from errors. Clears any previous error state and attempts a fresh connection.

#### `takePicture()`
Triggers a picture capture command that is broadcast to all connected camera devices via WebSocket. This function:

- Only works when `cameraState` is `CameraState.CONNECTED`
- Sends a `'take_picture'` command through the WebSocket channel
- The command is broadcast to all subscribed clients (camera interfaces)
- Camera interfaces can listen for this command to trigger photo capture

**Usage Example:**
```typescript
const { takePicture, cameraState } = useCamera({
  sessionId: "your-session-id",
  authToken: "your-api-token"
});

// Check if camera is connected before taking picture
if (cameraState === CameraState.CONNECTED) {
  takePicture(); // Broadcasts take picture command
}
```

**Note:** This function sends a command to trigger photo capture. The actual photo capturing and image processing happens on the camera device side (browser with camera access).

## License

MIT
