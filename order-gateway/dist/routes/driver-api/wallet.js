"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverWalletRoutes = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const logger_1 = require("../../logger");
const mysql_1 = require("../../mysql");
const config_1 = require("../../config");
const redis = new ioredis_1.default(config_1.config.REDIS_URL);
const driverWalletRoutes = async (server) => {
    // Middleware para verificar JWT
    server.addHook('onRequest', async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch (err) {
            reply.send(err);
        }
    });
    server.get('/earnings', async (request, reply) => {
        const { uuid: driverUuid } = request.user;
        // Cache de Ganhos (Redis TTL 5min) para evitar hit database quando 300 motoboys abrirem o app
        const cacheKey = `driver_earnings_${driverUuid}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return reply.send(JSON.parse(cached));
        }
        try {
            const connection = await (0, mysql_1.getDbConnection)();
            // Busca todas as ordens completed do driver
            const [orderRows] = await connection.query(`SELECT id, uuid, created_at, meta 
         FROM orders 
         WHERE driver_assigned_uuid = ? AND status = 'completed'
         ORDER BY created_at DESC LIMIT 50`, [driverUuid]);
            connection.release();
            let totalEarnings = 0;
            const history = orderRows.map(row => {
                let meta = {};
                try {
                    meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
                }
                catch (e) { }
                const amount = meta.financials?.driver_rate || 0;
                totalEarnings += amount;
                return {
                    order_id: row.uuid,
                    date: row.created_at,
                    amount: amount,
                    description: meta.source === 'open_delivery' ? 'Entrega Parceira' : 'Entrega Fleetbase'
                };
            });
            const responsePayload = {
                total_earnings: totalEarnings,
                history
            };
            // Grava no Redis com TTL de 300s (5 minutos)
            await redis.set(cacheKey, JSON.stringify(responsePayload), 'EX', 300);
            return reply.send(responsePayload);
        }
        catch (error) {
            logger_1.logger.error('Driver Earnings Error', error);
            return reply.status(500).send({ error: 'Failed to fetch earnings' });
        }
    });
    server.get('/wallet', async (request, reply) => {
        const { uuid: driverUuid } = request.user;
        // Opcional: Integração com Asaas se criarmos Subcontas para Motoboys.
        // Como estamos usando PIX Direto da Conta Master, a "Wallet" aqui reflete os ganhos retidos pendentes de fechamento.
        // Isso é um cálculo em tempo real do que ainda não foi pago no domingo.
        return reply.send({
            message: 'Wallet balance pending next weekly closure',
            status: 'active'
        });
    });
};
exports.driverWalletRoutes = driverWalletRoutes;
