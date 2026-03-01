import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'apiuser',
  password: process.env.POSTGRES_PASSWORD || '',
  database: process.env.POSTGRES_DB || 'ratelimit_api',
});

async function migrate() {
  const client = await pool.connect();

  try {
    console.log('Starting database migration...');

    // Start transaction
    await client.query('BEGIN');

    // Create users table
    console.log('Creating users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'enterprise')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create index on email
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    // Create api_keys table
    console.log('Creating api_keys table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(64) UNIQUE NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'suspended')),
        rate_limit_override INT,
        last_used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes on api_keys
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
    `);

    // Create request_logs table
    console.log('Creating request_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS request_logs (
        id BIGSERIAL PRIMARY KEY,
        api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
        endpoint VARCHAR(255) NOT NULL,
        http_method VARCHAR(10) NOT NULL,
        status_code INT NOT NULL,
        latency_ms INT NOT NULL,
        ip_address INET,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Create indexes on request_logs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_logs_api_key ON request_logs(api_key_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_logs_created_at ON request_logs(created_at DESC);
    `);

    // Create public_data table (sample data)
    console.log('Creating public_data table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS public_data (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Insert sample data
    console.log('Inserting sample data...');
    const countResult = await client.query('SELECT COUNT(*) FROM public_data');
    const count = parseInt(countResult.rows[0].count, 10);

    if (count === 0) {
      const categories = ['Technology', 'Science', 'Business', 'Health', 'Education'];
      const values: string[] = [];

      for (let i = 1; i <= 1000; i++) {
        const category = categories[Math.floor(Math.random() * categories.length)];
        values.push(`(
          'Item ${i}',
          'This is a sample description for item ${i}',
          '${category}',
          '{"id": ${i}, "data": "Sample value ${i}"}'
        )`);
      }

      await client.query(`
        INSERT INTO public_data (title, description, category, value)
        VALUES ${values.join(',')};
      `);

      console.log('Inserted 1000 sample records into public_data');
    } else {
      console.log(`public_data already has ${count} records, skipping seed`);
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('✓ Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('Database is ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  });
