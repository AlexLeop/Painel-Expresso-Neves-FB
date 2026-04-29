import mysql from 'mysql2/promise';
import { config } from './config';
import { logger } from './logger';

const pool = mysql.createPool({
  uri: config.DATABASE_URL || 'mysql://mysql:admin@expresso_neves_mysql:3306/expresso_neves',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const getDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    logger.error(error, 'Failed to connect to MySQL fallback');
    throw error;
  }
};
