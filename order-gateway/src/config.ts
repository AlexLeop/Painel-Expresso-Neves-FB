import * as dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  FLEETBASE_API_URL: process.env.FLEETBASE_API_URL || 'http://localhost:8000',
  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
  ASAAS_API_KEY: process.env.ASAAS_API_KEY || ''
};
