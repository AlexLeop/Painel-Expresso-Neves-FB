"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbConnection = void 0;
const promise_1 = __importDefault(require("mysql2/promise"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const pool = promise_1.default.createPool({
    uri: config_1.config.DATABASE_URL || 'mysql://mysql:admin@expresso_neves_mysql:3306/expresso_neves',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
const getDbConnection = async () => {
    try {
        const connection = await pool.getConnection();
        return connection;
    }
    catch (error) {
        logger_1.logger.error(error, 'Failed to connect to MySQL fallback');
        throw error;
    }
};
exports.getDbConnection = getDbConnection;
