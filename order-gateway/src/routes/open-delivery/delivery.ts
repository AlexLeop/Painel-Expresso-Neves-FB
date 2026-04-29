import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../../logger';
import { orderQueue } from '../../queue/orderQueue';
import { normalizeOpenDeliveryToFleetbase } from '../../normalizer/open-delivery';

interface DeliveryRequest {
  Body: any;
}

export const deliveryRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Aplicar hook de autenticação em todas as rotas deste plugin
  server.addHook('onRequest', server.authenticate);

  server.post<DeliveryRequest>('/delivery', async (request, reply) => {
    try {
      // Extrair informações do JWT validado (injetado via server.authenticate)
      const user = request.user as any;
      const fleetbaseApiKey = user.fleetbase_api_key;

      if (!fleetbaseApiKey) {
        logger.error('JWT validado, mas sem fleetbase_api_key no payload.');
        return reply.status(403).send({ error: 'forbidden', message: 'API Key not found in token' });
      }

      logger.info({ organization: user.sub }, 'Recebido webhook POST /logistics/delivery');

      const rawPayload = request.body;
      
      // Enfileirar para processamento assíncrono garantindo alta performance
      await orderQueue.add('process-open-delivery', {
        payload: rawPayload,
        fleetbase_api_key: fleetbaseApiKey
      });

      // Retornar 201 Created (ou 200 OK) imediatamente para o PDV parceiro
      return reply.status(201).send({
        status: 'success',
        message: 'Delivery order received and queued for processing.'
      });

    } catch (error) {
      logger.error({ err: error }, 'Erro interno ao processar webhook /logistics/delivery');
      return reply.status(500).send({ error: 'server_error', message: 'Failed to process delivery' });
    }
  });
};
