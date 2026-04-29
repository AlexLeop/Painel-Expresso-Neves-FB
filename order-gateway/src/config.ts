import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  DATABASE_URL: process.env.DATABASE_URL || process.env.DB_CONNECTION || 'mysql://localhost:3306/fleetbase',
  FLEETBASE_API_URL: process.env.FLEETBASE_API_URL || 'http://localhost:8000',
  FLEETBASE_API_KEY: process.env.FLEETBASE_API_KEY || '',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  ASAAS_API_KEY: process.env.ASAAS_API_KEY || ''
};
