import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  // Close our idle connections before NeonDB does (~5 min). The pool will
  // create a fresh one on the next request.
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Send TCP keepalive packets so dead connections are detected before
  // a query tries to use them.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// Idle clients can be closed by NeonDB after sustained inactivity (this is
// expected serverless Postgres behaviour). Don't crash the server — just log
// it and let the pool recover by creating a fresh client on the next request.
pool.on('error', (err) => {
  console.error('[pg-pool] Idle client error (likely NeonDB closing an idle connection):', err.message);
});

export default pool;

