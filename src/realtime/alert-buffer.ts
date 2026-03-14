import { BufferedAlert } from "./types.js";

export class AlertBuffer {
  private buffer: BufferedAlert[] = [];
  private maxSize: number;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  push(alert: BufferedAlert): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(alert);
  }

  poll(limit: number): BufferedAlert[] {
    const count = Math.min(limit, this.buffer.length);
    return this.buffer.splice(0, count);
  }

  peek(limit: number): BufferedAlert[] {
    return this.buffer.slice(0, limit);
  }

  clear(): void {
    this.buffer = [];
  }

  size(): number {
    return this.buffer.length;
  }
}
