import { io, Socket } from "socket.io-client";
import { CONFIG } from "../config.js";
import { AlertBuffer } from "./alert-buffer.js";
import { ALL_ALERT_TYPES, AlertPayload, ConnectionState } from "./types.js";

export class ConnectionManager {
  private socket: Socket | null = null;
  private state: ConnectionState = {
    connected: false,
    subscribedTypes: [],
    testMode: false,
    connectedSince: null,
    totalAlertsReceived: 0,
  };
  private alertBuffer = new AlertBuffer();

  async subscribe(options: {
    alertTypes?: string[];
    testMode?: boolean;
    timing?: string;
  }): Promise<{
    status: string;
    subscribedTypes: string[];
    testMode: boolean;
    message: string;
  }> {
    // Disconnect existing connection if any
    if (this.socket) {
      this.disconnect();
    }

    const { alertTypes, testMode = false, timing } = options;

    // Validate alert types if provided
    if (alertTypes && alertTypes.length > 0) {
      const validTypes = new Set<string>(ALL_ALERT_TYPES);
      const invalid = alertTypes.filter((t) => !validTypes.has(t));
      if (invalid.length > 0) {
        throw new Error(
          `Invalid alert types: ${invalid.join(", ")}. Valid types: ${ALL_ALERT_TYPES.join(", ")}`
        );
      }
    }

    const baseUrl = CONFIG.SOCKET_URL;
    const url = testMode ? `${baseUrl}/test` : baseUrl;

    const query: Record<string, string> = {};
    if (alertTypes && alertTypes.length > 0) {
      query.alerts = alertTypes.join(",");
    }
    if (timing) {
      query.timing = timing;
    }

    this.socket = io(url, {
      auth: { apiKey: CONFIG.API_KEY },
      query,
      reconnection: true,
      reconnectionAttempts: CONFIG.SOCKET_RECONNECT_ATTEMPTS,
      reconnectionDelay: CONFIG.SOCKET_RECONNECT_DELAY_MS,
      reconnectionDelayMax: 30000,
      timeout: 10000,
    });

    const typesToListen =
      alertTypes && alertTypes.length > 0
        ? alertTypes
        : [...ALL_ALERT_TYPES];

    // Register alert event listeners
    for (const alertType of typesToListen) {
      this.socket.on(alertType, (data: AlertPayload) => {
        this.alertBuffer.push({
          receivedAt: new Date().toISOString(),
          type: data.type || alertType,
          title: data.title || "",
          cities: data.cities || [],
          instructions: data.instructions || "",
        });
        this.state.totalAlertsReceived++;
      });
    }

    // Track connection state
    this.socket.on("connect", () => {
      this.state.connected = true;
      this.state.connectedSince = new Date().toISOString();
      console.error("[redalert] Socket.IO connected");
    });

    this.socket.on("disconnect", (reason) => {
      this.state.connected = false;
      console.error(`[redalert] Socket.IO disconnected: ${reason}`);
    });

    this.socket.on("connect_error", (err) => {
      console.error(`[redalert] Socket.IO connection error: ${err.message}`);
    });

    // Wait for connection or error
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(
          new Error(`Failed to connect to RedAlert Socket.IO: ${err.message}`)
        );
      };
      const cleanup = () => {
        this.socket?.off("connect", onConnect);
        this.socket?.off("connect_error", onError);
      };
      this.socket!.once("connect", onConnect);
      this.socket!.once("connect_error", onError);
    });

    this.state.subscribedTypes = typesToListen;
    this.state.testMode = testMode;
    this.alertBuffer.clear();

    return {
      status: "connected",
      subscribedTypes: typesToListen,
      testMode,
      message:
        "Subscribed to real-time alerts. Use poll_alerts to retrieve incoming alerts.",
    };
  }

  pollAlerts(
    limit: number = 50,
    acknowledge: boolean = true
  ): {
    connected: boolean;
    alertCount: number;
    bufferSize: number;
    alerts: import("./types.js").BufferedAlert[];
  } {
    if (!this.socket) {
      throw new Error(
        "Not subscribed to alerts. Call subscribe_alerts first."
      );
    }

    const alerts = acknowledge
      ? this.alertBuffer.poll(limit)
      : this.alertBuffer.peek(limit);

    return {
      connected: this.state.connected,
      alertCount: alerts.length,
      bufferSize: this.alertBuffer.size(),
      alerts,
    };
  }

  disconnect(): { status: string; message: string } {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.alertBuffer.clear();
    this.state = {
      connected: false,
      subscribedTypes: [],
      testMode: false,
      connectedSince: null,
      totalAlertsReceived: 0,
    };
    return {
      status: "disconnected",
      message: "Unsubscribed from real-time alerts. Buffer cleared.",
    };
  }

  getStatus(): {
    connected: boolean;
    subscribedTypes: string[];
    testMode: boolean;
    bufferedAlerts: number;
    connectedSince: string | null;
    totalAlertsReceived: number;
  } {
    return {
      connected: this.state.connected,
      subscribedTypes: this.state.subscribedTypes,
      testMode: this.state.testMode,
      bufferedAlerts: this.alertBuffer.size(),
      connectedSince: this.state.connectedSince,
      totalAlertsReceived: this.state.totalAlertsReceived,
    };
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
