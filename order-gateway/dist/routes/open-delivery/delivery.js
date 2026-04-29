"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliveryRoutes = void 0;
const logger_1 = require("../../logger");
const orderQueue_1 = require("../../queue/orderQueue");
const deliveryRoutes = async (server) => {
    // Aplicar hook de autenticação em todas as rotas deste plugin
    server.addHook('onRequest', server.authenticate);
    server.post('/delivery', async (request, reply) => {
        try {
            // Extrair informações do JWT validado (injetado via server.authenticate)
            const user = request.user;
            const fleetbaseApiKey = user.fleetbase_api_key;
            if (!fleetbaseApiKey) {
                logger_1.logger.error('JWT validado, mas sem fleetbase_api_key no payload.');
                return reply.status(403).send({ error: 'forbidden', message: 'API Key not found in token' });
            }
            logger_1.logger.info({ organization: user.sub }, 'Recebido webhook POST /logistics/delivery');
            const rawPayload = request.body;
            // Enfileirar para processamento assíncrono garantindo alta performance
            await orderQueue_1.orderQueue.add('process-open-delivery', {
                payload: rawPayload,
                fleetbase_api_key: fleetbaseApiKey
            });
            // Retornar 201 Created (ou 200 OK) imediatamente para o PDV parceiro
            return reply.status(201).send({
                status: 'success',
                message: 'Delivery order received and queued for processing.'
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error }, 'Erro interno ao processar webhook /logistics/delivery');
            return reply.status(500).send({ error: 'server_error', message: 'Failed to process delivery' });
        }
    });
};
exports.deliveryRoutes = deliveryRoutes;
