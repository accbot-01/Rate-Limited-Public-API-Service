import config from '../config';

export interface LogEntry {
  timestamp: string;
  apiKeyId: string;
  endpoint: string;
  httpMethod: string;
  statusCode: number;
  latencyMs: number;
  ipAddress: string;
}

class LogBuffer {
  private buffer: LogEntry[] = [];
  private maxSize: number;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(maxSize: number = config.logging.batchSize) {
    this.maxSize = maxSize;
  }

  push(entry: LogEntry): void {
    if (this.buffer.length >= this.maxSize) {
      console.warn('[LOG BUFFER] Buffer full, dropping oldest entry');
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  flush(): LogEntry[] {
    const batch = this.buffer.splice(0, config.logging.batchSize);
    return batch;
  }

  size(): number {
    return this.buffer.length;
  }

  startAutoFlush(callback: (batch: LogEntry[]) => Promise<void>): void {
    if (this.flushInterval) {
      return;
    }

    this.flushInterval = setInterval(async () => {
      const batch = this.flush();
      if (batch.length > 0) {
        try {
          await callback(batch);
          console.log(`[LOG WORKER] Flushed ${batch.length} logs to database`);
        } catch (error) {
          console.error('[LOG WORKER] Failed to flush logs:', error);
          // Re-add to buffer if flush fails
          this.buffer.unshift(...batch);
        }
      }
    }, config.logging.batchIntervalMs);
  }

  stopAutoFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }
}

export const logBuffer = new LogBuffer();
export default logBuffer;
