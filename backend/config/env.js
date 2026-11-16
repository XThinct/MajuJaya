import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
function required(name) {
  if (!process.env[name]) throw new Error(`${name} is required. Update the root .env file.`);
  return process.env[name];
}
function port(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a valid port number.`);
  return value;
}
export const env = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    user: required('DB_USER'),
    password: required('DB_PASS'),
    name: required('DB_NAME'),
    port: port('DB_PORT', 5432),
  },
  dbLogging: process.env.DB_LOGGING === 'true',
  jwtSecret: required('JWT_SECRET'),
  port: port('PORT', 8000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  production: process.env.NODE_ENV === 'production',
};
if (env.jwtSecret.length < 32) throw new Error('JWT_SECRET must have at least 32 characters.');
