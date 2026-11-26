import mysql from 'mysql2/promise';

// T23: kredensial wajib dari environment; tidak ada fallback yang tertulis di sumber.
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi`);
  return value;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASS'),
  database: process.env.DB_NAME || 'klinikflow_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
