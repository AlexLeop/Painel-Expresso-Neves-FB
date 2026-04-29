"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const config_1 = require("./config");
const logger_1 = require("./logger");
const orderQueue_1 = require("./queue/orderQueue");
const auth_1 = require("./routes/open-delivery/auth");
const delivery_1 = require("./routes/open-delivery/delivery");
const server = (0, fastify_1.default)({ logger: logger_1.logger });
// Register JWT
server.register(jwt_1.default, {
    secret: config_1.config.JWT_SECRET
});
// Decorate request with authenticate method
server.decorate("authenticate", async function (request, reply) {
    try {
        await request.jwtVerify();
    }
    catch (err) {
        reply.send(err);
    }
});
// Health Check Endpoint
server.get('/health', async (request, reply) => {
    try {
        // Check Redis / Queue connection
        const isReady = await orderQueue_1.orderQueue.client.then(client => client.status === 'ready');
        if (!isReady) {
            reply.status(503).send({ status: 'error', message: 'Redis is not ready' });
            return;
        }
        // TODO: Optionally add a check to FleetOps API directly here if needed, 
        // but often it's better to keep health check fast and isolated.
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
            redis: 'connected',
            queue_name: orderQueue_1.orderQueue.name
        };
    }
    catch (error) {
        logger_1.logger.error({ err: error }, 'Health check failed');
        reply.status(500).send({ status: 'error', message: 'Internal Server Error' });
    }
});
const list_1 = require("./routes/integracoes-api/list");
const dashboard_1 = require("./routes/financeiro-api/dashboard");
const auth_2 = require("./routes/driver-api/auth");
const wallet_1 = require("./routes/driver-api/wallet");
const fleetbase_1 = require("./routes/webhooks/fleetbase");
// Register Routes
server.register(auth_1.authRoutes, { prefix: '/oauth' });
server.register(delivery_1.deliveryRoutes, { prefix: '/logistics' });
server.register(list_1.integrationsApiRoutes, { prefix: '/integracoes-api' });
server.register(dashboard_1.financeiroApiRoutes, { prefix: '/financeiro-api' });
server.register(auth_2.driverAuthRoutes, { prefix: '/driver-api/auth' });
server.register(wallet_1.driverWalletRoutes, { prefix: '/driver-api' });
server.register(fleetbase_1.fleetbaseWebhookRoutes, { prefix: '/webhooks' });
const start = async () => {
    try {
        await server.listen({ port: config_1.config.PORT, host: '0.0.0.0' });
        logger_1.logger.info(`Server listening on port ${config_1.config.PORT}`);
    }
    catch (err) {
        logger_1.logger.error(err);
        process.exit(1);
    }
};
start();
