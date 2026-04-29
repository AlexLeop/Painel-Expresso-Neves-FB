import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { config } from './config';
import { logger } from './logger';
import { orderQueue } from './queue/orderQueue';
import { authRoutes } from './routes/open-delivery/auth';
import { deliveryRoutes } from './routes/open-delivery/delivery';

const server = fastify({ logger });

// Register JWT
server.register(fastifyJwt, {
  secret: config.JWT_SECRET
});

// Type augmentation for FastifyInstance
declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: any;
  }
}

// Decorate request with authenticate method
server.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Health Check Endpoint
server.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Check Redis / Queue connection
    const isReady = await orderQueue.client.then(client => client.status === 'ready');
    
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
        queue_name: orderQueue.name
    };
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    reply.status(500).send({ status: 'error', message: 'Internal Server Error' });
  }
});

import { integrationsApiRoutes } from './routes/integracoes-api/list';
import { financeiroApiRoutes } from './routes/financeiro-api/dashboard';
import { driverAuthRoutes } from './routes/driver-api/auth';
import { driverWalletRoutes } from './routes/driver-api/wallet';
import { fleetbaseWebhookRoutes } from './routes/webhooks/fleetbase';

// Register Routes
server.register(authRoutes, { prefix: '/oauth' });
server.register(deliveryRoutes, { prefix: '/logistics' });
server.register(integrationsApiRoutes, { prefix: '/integracoes-api' });
server.register(financeiroApiRoutes, { prefix: '/financeiro-api' });
server.register(driverAuthRoutes, { prefix: '/driver-api/auth' });
server.register(driverWalletRoutes, { prefix: '/driver-api' });
server.register(fleetbaseWebhookRoutes, { prefix: '/webhooks' });

const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    logger.info(`Server listening on port ${config.PORT}`);
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
