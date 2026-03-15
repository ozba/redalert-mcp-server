import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export class RedAlertApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
  ) {
    super(`RedAlert API error: ${status} ${statusText}`);
    this.name = "RedAlertApiError";
  }
}

export function mapToMcpError(error: unknown): McpError {
  if (error instanceof RedAlertApiError) {
    if (error.status === 400 || error.status === 404) {
      return new McpError(ErrorCode.InvalidParams, error.message);
    }
    if (error.status === 401 || error.status === 403) {
      return new McpError(ErrorCode.InternalError, "Authentication failed - check REDALERT_API_KEY");
    }
    if (error.status === 429) {
      return new McpError(ErrorCode.InternalError, "Rate limited by RedAlert API - try again later");
    }
    return new McpError(ErrorCode.InternalError, `RedAlert API server error: ${error.status}`);
  }

  if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("network"))) {
    return new McpError(ErrorCode.InternalError, "Failed to connect to RedAlert API");
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new McpError(ErrorCode.InternalError, "Request to RedAlert API timed out");
  }

  if (error instanceof McpError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new McpError(ErrorCode.InternalError, `Unexpected error: ${message}`);
}

export function formatErrorResult(error: unknown): { content: Array<{ type: "text"; text: string }>; isError: true } {
  const mcpError = mapToMcpError(error);
  return {
    content: [{ type: "text" as const, text: mcpError.message }],
    isError: true,
  };
}

/**
 * Convert a UTC ISO timestamp to Israel time ISO timestamp.
 * Israel is UTC+2 (winter, Nov-Mar) or UTC+3 (summer DST, Apr-Oct).
 */
function utcToIsrael(utcStr: string): string {
  const d = new Date(utcStr);
  if (isNaN(d.getTime())) return utcStr;
  const month = d.getUTCMonth(); // 0-indexed
  const offset = (month >= 3 && month <= 9) ? 3 : 2;
  const israel = new Date(d.getTime() + offset * 3600000);
  const yyyy = israel.getUTCFullYear();
  const mm = String(israel.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(israel.getUTCDate()).padStart(2, "0");
  const hh = String(israel.getUTCHours()).padStart(2, "0");
  const min = String(israel.getUTCMinutes()).padStart(2, "0");
  const ss = String(israel.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}+0${offset}:00`;
}

/**
 * Recursively walk a JSON object and convert any "timestamp" fields from UTC to Israel time.
 */
function convertTimestamps(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "timestamp" && typeof value === "string" && value.endsWith("Z")) {
        result[key] = utcToIsrael(value);
      } else {
        result[key] = convertTimestamps(value);
      }
    }
    return result;
  }
  return obj;
}

export function formatSuccessResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  const converted = convertTimestamps(data);
  return {
    content: [{ type: "text" as const, text: JSON.stringify(converted, null, 2) }],
  };
}
