import { renderHook, waitFor, act } from "@testing-library/react";
import { useCamera } from "./useCamera";
import { CameraState } from "./types";

// Mock Phoenix Socket and Channel
const mockConnect = jest.fn();
const mockDisconnect = jest.fn();
const mockLeave = jest.fn();
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
    expect(result.current.imageURL).toBe("");
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
});