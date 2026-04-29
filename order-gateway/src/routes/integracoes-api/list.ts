import { FastifyInstance, FastifyPluginAsync } from 'fastify';

export const integrationsApiRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.get('/v1/integrations', async (request, reply) => {
    // Retorna a estrutura no formato JSON:API compatível com Ember Data
    return {
      data: [
        {
          type: 'integration',
          id: '1',
          attributes: {
            name: 'Integração Open Delivery',
            provider: 'open_delivery',
            status: 'active',
            client_id: '12345-abc',
            api_key: 'flb_live_12345_abc_mock_key',
            last_error_log: null,
            last_error_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        },
        {
          type: 'integration',
          id: '2',
          attributes: {
            name: 'Integração iFood (Sandbox)',
            provider: 'ifood',
            status: 'inactive',
            client_id: null,
            api_key: null,
            last_error_log: 'iFood API Token expired or revoked. Please re-authenticate.',
            last_error_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        }
      ]
    };
  });
};
