import { renderHook, waitFor, act } from "@testing-library/react";
import { useCamera } from "./useCamera";
import { CameraState } from "./types";

// Mock Phoenix Socket and Channel
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockLeave = jest.fn();
const mockChannelPush = jest.fn();
let mockEndpoint: string | null;
let mockOptions: any;
let mockTopic: string | null;

const mockPush: any = {
  receive: jest.fn((status: string, callback: (data: any) => void) => {
    if (status === "ok") {
      callback({ resp: "ok" });
    }
    return mockPush;
  }),
};

const mockChannel = {
  join: jest.fn(() => mockPush),
  on: jest.fn(),
  leave: mockLeave,
  push: mockChannelPush,
};

const mockChannelFn = jest.fn((topic) => {
  mockTopic = topic;
  return mockChannel;
});

const mockSocket = {
  channel: mockChannelFn,
  connect: mockConnect,
  disconnect: mockDisconnect,
};

jest.mock("phoenix", () => ({
  Socket: jest.fn((endpoint: string, options: any) => {
    mockEndpoint = endpoint;
    mockOptions = options;
    return mockSocket;
  }),
}));

describe("useCamera", () => {
  const originalFetch = window.fetch;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEndpoint = null;
    mockOptions = null;
    mockTopic = null;

    window.fetch = jest.fn();
    consoleSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    window.fetch = originalFetch;
    consoleSpy.mockRestore();
  });

  it("should return initial state", () => {
    const { result } = renderHook(() => useCamera("test-session"));

    expect(result.current.cameraState).toBe(CameraState.WAITING);
    expect(result.current.qrCodeURL).toBe("");
    expect(result.current.imageURLs).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(typeof result.current.initialize).toBe("function");
    expect(typeof result.current.disconnect).toBe("function");
    expect(typeof result.current.retry).toBe("function");
  });

  it("should fetch camera data and set up socket when initialize is called", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(window.fetch).toHaveBeenCalledWith(
      "https://poscam.shop/api/cameras",
      {
        body: JSON.stringify({ session_id: "test-session" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.qrCodeURL).toBe(
      "http://localhost:4000/images/qr/ABC123.png",
    );
    expect(result.current.cameraState).toBe(CameraState.WAITING);
    expect(result.current.error).toBe(null);

    expect(mockEndpoint).toBe("wss://poscam.shop/socket");
    expect(mockOptions).toEqual({ params: { code: "ABC123" } });
    expect(mockConnect).toHaveBeenCalled();
    expect(mockChannelFn).toHaveBeenCalledWith("camera:channel:ABC123");
    expect(mockChannel.join).toHaveBeenCalled();
  });

  it("should use custom host configuration", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() =>
      useCamera("test-session", { host: "localhost:4000", useHttps: false }),
    );

    await act(async () => {
      await result.current.initialize();
    });

    expect(window.fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/cameras",
      expect.any(Object),
    );

    expect(mockEndpoint).toBe("ws://localhost:4000/socket");
  });

  it("should handle fetch errors", async () => {
    (window.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      statusText: "Not Found",
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Failed to fetch camera: Not Found");
  });

  it("should handle network errors", async () => {
    (window.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe("Network error");
  });

  it("should set up event listeners for state and image updates", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(mockChannel.on).toHaveBeenCalledWith("state", expect.any(Function));
    expect(mockChannel.on).toHaveBeenCalledWith(
      "image_url",
      expect.any(Function),
    );
  });

  it("should disconnect socket when disconnect is called", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(mockConnect).toHaveBeenCalled();

    act(() => {
      result.current.disconnect();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should disconnect socket when state changes to closed", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.CLOSED,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("should not fetch when sessionId is empty", () => {
    renderHook(() => useCamera(""));

    expect(window.fetch).not.toHaveBeenCalled();
  });

  it("should accumulate imageURLs when multiple image_url events are received", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.imageURLs).toEqual([]);

    // Simulate multiple image_url events
    const imageUrlCallback = mockChannel.on.mock.calls.find(
      (call) => call[0] === "image_url",
    )?.[1];

    act(() => {
      imageUrlCallback?.({ url: "http://example.com/image1.jpg" });
    });

    expect(result.current.imageURLs).toEqual([
      expect.stringContaining("http://example.com/image1.jpg#"),
    ]);

    act(() => {
      imageUrlCallback?.({ url: "http://example.com/image2.jpg" });
    });

    expect(result.current.imageURLs).toEqual([
      expect.stringContaining("http://example.com/image1.jpg#"),
      expect.stringContaining("http://example.com/image2.jpg#"),
    ]);
  });

  it("should clear imageURLs when camera state changes to CLOSED", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    // Add some images
    const imageUrlCallback = mockChannel.on.mock.calls.find(
      (call) => call[0] === "image_url",
    )?.[1];

    act(() => {
      imageUrlCallback?.({ url: "http://example.com/image1.jpg" });
      imageUrlCallback?.({ url: "http://example.com/image2.jpg" });
    });

    expect(result.current.imageURLs).toHaveLength(2);

    // Simulate state change to CLOSED
    const stateCallback = mockChannel.on.mock.calls.find(
      (call) => call[0] === "state",
    )?.[1];

    act(() => {
      stateCallback?.({ state: CameraState.CLOSED });
    });

    expect(result.current.imageURLs).toEqual([]);
  });

  it("should clear imageURLs on initialize for new session", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    // Add some images
    const imageUrlCallback = mockChannel.on.mock.calls.find(
      (call) => call[0] === "image_url",
    )?.[1];

    act(() => {
      imageUrlCallback?.({ url: "http://example.com/image1.jpg" });
    });

    expect(result.current.imageURLs).toHaveLength(1);

    // Re-initialize (new session)
    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.imageURLs).toEqual([]);
  });

  it("should include takePicture function in return object", () => {
    const { result } = renderHook(() => useCamera("test-session"));

    expect(typeof result.current.takePicture).toBe("function");
  });

  it("should send take_picture command when takePicture is called and camera is connected", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    // Simulate camera state change to connected
    const stateCallback = mockChannel.on.mock.calls.find(
      (call) => call[0] === "state",
    )?.[1];

    act(() => {
      stateCallback?.({ state: CameraState.CONNECTED });
    });

    expect(result.current.cameraState).toBe(CameraState.CONNECTED);

    // Call takePicture
    act(() => {
      result.current.takePicture();
    });

    expect(mockChannelPush).toHaveBeenCalledWith("take_picture", {});
  });

  it("should not send take_picture command when camera is not connected", async () => {
    const mockResponse = {
      camera: {
        code: "ABC123",
        qrcode_url: "http://localhost:4000/images/qr/ABC123.png",
        state: CameraState.WAITING,
      },
    };

    (window.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockResponse),
    });

    const { result } = renderHook(() => useCamera("test-session"));

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.cameraState).toBe(CameraState.WAITING);

    // Call takePicture while still waiting
    act(() => {
      result.current.takePicture();
    });

    expect(mockChannelPush).not.toHaveBeenCalled();
  });

  it("should not send take_picture command when channel is not available", () => {
    const { result } = renderHook(() => useCamera("test-session"));

    // Call takePicture without initializing
    act(() => {
      result.current.takePicture();
    });

    expect(mockChannelPush).not.toHaveBeenCalled();
  });
});
