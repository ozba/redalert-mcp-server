import { describe, it, expect } from "vitest";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import {
  RedAlertApiError,
  mapToMcpError,
  formatErrorResult,
  formatSuccessResult,
} from "../errors.js";

describe("RedAlertApiError", () => {
  it("should construct with status, statusText, and body", () => {
    const err = new RedAlertApiError(404, "Not Found", "no data");
    expect(err.status).toBe(404);
    expect(err.statusText).toBe("Not Found");
    expect(err.body).toBe("no data");
    expect(err.name).toBe("RedAlertApiError");
    expect(err.message).toBe("RedAlert API error: 404 Not Found");
  });

  it("should be an instance of Error", () => {
    const err = new RedAlertApiError(500, "Internal Server Error", "");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("mapToMcpError", () => {
  it("should map 400 to InvalidParams", () => {
    const err = new RedAlertApiError(400, "Bad Request", "");
    const result = mapToMcpError(err);
    expect(result).toBeInstanceOf(McpError);
    expect(result.code).toBe(ErrorCode.InvalidParams);
  });

  it("should map 404 to InvalidParams", () => {
    const err = new RedAlertApiError(404, "Not Found", "");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InvalidParams);
  });

  it("should map 401 to InternalError with auth message", () => {
    const err = new RedAlertApiError(401, "Unauthorized", "");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("Authentication failed");
  });

  it("should map 403 to InternalError with auth message", () => {
    const err = new RedAlertApiError(403, "Forbidden", "");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("Authentication failed");
  });

  it("should map 429 to rate limit error", () => {
    const err = new RedAlertApiError(429, "Too Many Requests", "");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("Rate limited");
  });

  it("should map 500 to server error", () => {
    const err = new RedAlertApiError(500, "Internal Server Error", "");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("server error: 500");
  });

  it("should map network TypeError to connection error", () => {
    const err = new TypeError("fetch failed");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("Failed to connect");
  });

  it("should map AbortError to timeout", () => {
    const err = new DOMException("The operation was aborted.", "AbortError");
    const result = mapToMcpError(err);
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("timed out");
  });

  it("should pass through McpError unchanged", () => {
    const err = new McpError(ErrorCode.InvalidParams, "test message");
    const result = mapToMcpError(err);
    expect(result).toBe(err);
  });

  it("should wrap unknown errors", () => {
    const result = mapToMcpError("something broke");
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("something broke");
  });

  it("should wrap Error instances", () => {
    const result = mapToMcpError(new Error("generic error"));
    expect(result.code).toBe(ErrorCode.InternalError);
    expect(result.message).toContain("generic error");
  });
});

describe("formatErrorResult", () => {
  it("should return isError true with text content", () => {
    const err = new RedAlertApiError(429, "Too Many Requests", "");
    const result = formatErrorResult(err);
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Rate limited");
  });
});

describe("formatSuccessResult", () => {
  it("should return JSON-stringified content", () => {
    const data = { foo: "bar", count: 42 };
    const result = formatSuccessResult(data);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(data);
  });

  it("should not have isError property", () => {
    const result = formatSuccessResult({});
    expect(result).not.toHaveProperty("isError");
  });

  it("should handle null data", () => {
    const result = formatSuccessResult(null);
    expect(result.content[0].text).toBe("null");
  });

  it("should handle arrays", () => {
    const result = formatSuccessResult([1, 2, 3]);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual([1, 2, 3]);
  });
});
