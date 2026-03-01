import db from '../models/database';
import { logBuffer, LogEntry } from '../utils/logBuffer';
import { PaginatedResponse } from '../types';

export class LoggingService {
  /**
   * Log API request (async, non-blocking)
   */
  logRequest(entry: LogEntry): void {
    // Add to buffer (will be flushed periodically)
    logBuffer.push(entry);

    // Optional: Also log to CloudWatch here if configured
    // cloudwatchService.log(entry);
  }

  /**
   * Flush log batch to database
   */
  async flushLogs(batch: LogEntry[]): Promise<void> {
    if (batch.length === 0) return;

    const values: unknown[] = [];
    const placeholders: string[] = [];
    
    batch.forEach((entry, index) => {
      const offset = index * 7;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
      );
      values.push(
        entry.apiKeyId,
        entry.endpoint,
        entry.httpMethod,
        entry.statusCode,
        entry.latencyMs,
        entry.ipAddress,
        entry.timestamp
      );
    });

    const query = `
      INSERT INTO request_logs 
      (api_key_id, endpoint, http_method, status_code, latency_ms, ip_address, created_at)
      VALUES ${placeholders.join(', ')}
    `;

    try {
      await db.query(query, values);
    } catch (error) {
      console.error('[LOGGING SERVICE] Failed to flush logs to database:', error);
      // In production, write to backup file
      throw error;
    }
  }

  /**
   * Start auto-flush worker
   */
  startAutoFlush(): void {
    logBuffer.startAutoFlush(async (batch) => {
      await this.flushLogs(batch);
    });
  }

  /**
   * Stop auto-flush worker
   */
  stopAutoFlush(): void {
    logBuffer.stopAutoFlush();
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(
    apiKeyId?: string,
    days: number = 7
  ): Promise<{
    totalRequests: number;
    avgLatency: number;
    statusBreakdown: Record<string, number>;
  }> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    let query = `
      SELECT 
        COUNT(*) as total_requests,
        AVG(latency_ms) as avg_latency,
        status_code
      FROM request_logs
      WHERE created_at >= $1
    `;

    const params: unknown[] = [dateThreshold];

    if (apiKeyId) {
      query += ` AND api_key_id = $2`;
      params.push(apiKeyId);
    }

    query += ` GROUP BY status_code`;

    const result = await db.query(query, params);

    const totalRequests = result.rows.reduce((sum: number, row: { total_requests: string }) => 
      sum + parseInt(row.total_requests, 10), 0);
    const avgLatency = result.rows.length > 0
      ? result.rows.reduce((sum: number, row: { avg_latency: string }) => 
          sum + parseFloat(row.avg_latency), 0) / result.rows.length
      : 0;

    const statusBreakdown: Record<string, number> = {};
    result.rows.forEach((row: { status_code: number; total_requests: string }) => {
      statusBreakdown[row.status_code] = parseInt(row.total_requests, 10);
    });

    return {
      totalRequests,
      avgLatency: Math.round(avgLatency),
      statusBreakdown,
    };
  }

  /**
   * Get recent logs for an API key
   */
  async getRecentLogs(
    apiKeyId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResponse<LogEntry>> {
    const offset = (page - 1) * limit;

    const countResult = await db.query(
      'SELECT COUNT(*) FROM request_logs WHERE api_key_id = $1',
      [apiKeyId]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    const logsResult = await db.query(
      `SELECT * FROM request_logs 
       WHERE api_key_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [apiKeyId, limit, offset]
    );

    return {
      data: logsResult.rows as LogEntry[],
      pagination: {
        page,
        limit,
        total,
        hasMore: offset + limit < total,
      },
    };
  }
}

export const loggingService = new LoggingService();
export default loggingService;
