import { Pool, PoolClient } from 'pg';
import config from '../config';

class Database {
  private pool: Pool;

  constructor() {
    this.pool = new Pool(config.database);

    this.pool.on('error', (err: Error) => {
      console.error('Unexpected database error:', err);
    });
  }

  async query(text: string, params?: unknown[]) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      if (config.env === 'development') {
        console.log('Executed query', { text, duration, rows: result.rowCount });
      }
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const db = new Database();
export default db;
