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

export function formatSuccessResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}
