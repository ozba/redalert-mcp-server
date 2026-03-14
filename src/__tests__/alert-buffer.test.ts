import { describe, it, expect, beforeEach } from "vitest";
import { AlertBuffer } from "../realtime/alert-buffer.js";
import type { BufferedAlert } from "../realtime/types.js";

function makeAlert(id: number): BufferedAlert {
  return {
    receivedAt: new Date().toISOString(),
    type: "missiles",
    title: `Alert ${id}`,
    cities: [`City${id}`],
    instructions: "Take cover",
  };
}

describe("AlertBuffer", () => {
  let buffer: AlertBuffer;

  beforeEach(() => {
    buffer = new AlertBuffer(5);
  });

  it("should start empty", () => {
    expect(buffer.size()).toBe(0);
  });

  it("should push and track size", () => {
    buffer.push(makeAlert(1));
    expect(buffer.size()).toBe(1);
    buffer.push(makeAlert(2));
    expect(buffer.size()).toBe(2);
  });

  it("should evict oldest when exceeding maxSize", () => {
    for (let i = 1; i <= 6; i++) {
      buffer.push(makeAlert(i));
    }
    expect(buffer.size()).toBe(5);
    // The oldest (Alert 1) should have been evicted
    const alerts = buffer.peek(5);
    expect(alerts[0].title).toBe("Alert 2");
    expect(alerts[4].title).toBe("Alert 6");
  });

  it("poll should remove alerts from buffer", () => {
    buffer.push(makeAlert(1));
    buffer.push(makeAlert(2));
    buffer.push(makeAlert(3));

    const polled = buffer.poll(2);
    expect(polled).toHaveLength(2);
    expect(polled[0].title).toBe("Alert 1");
    expect(polled[1].title).toBe("Alert 2");
    expect(buffer.size()).toBe(1);
  });

  it("poll should return at most what is available", () => {
    buffer.push(makeAlert(1));
    const polled = buffer.poll(10);
    expect(polled).toHaveLength(1);
    expect(buffer.size()).toBe(0);
  });

  it("peek should not remove alerts", () => {
    buffer.push(makeAlert(1));
    buffer.push(makeAlert(2));

    const peeked = buffer.peek(2);
    expect(peeked).toHaveLength(2);
    expect(buffer.size()).toBe(2);
  });

  it("peek should return at most limit items", () => {
    buffer.push(makeAlert(1));
    buffer.push(makeAlert(2));
    buffer.push(makeAlert(3));

    const peeked = buffer.peek(2);
    expect(peeked).toHaveLength(2);
    expect(peeked[0].title).toBe("Alert 1");
  });

  it("clear should empty the buffer", () => {
    buffer.push(makeAlert(1));
    buffer.push(makeAlert(2));
    buffer.clear();
    expect(buffer.size()).toBe(0);
  });

  it("should work with default maxSize", () => {
    const defaultBuffer = new AlertBuffer();
    for (let i = 0; i < 501; i++) {
      defaultBuffer.push(makeAlert(i));
    }
    // Default maxSize is 500
    expect(defaultBuffer.size()).toBe(500);
  });
});
