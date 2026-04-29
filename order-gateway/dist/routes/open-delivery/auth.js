"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const logger_1 = require("../../logger");
const authRoutes = async (server) => {
    server.post('/token', async (request, reply) => {
        const { grant_type, client_id, client_secret } = request.body;
        if (grant_type !== 'client_credentials') {
            return reply.status(400).send({ error: 'unsupported_grant_type' });
        }
        try {
            // TODO: Buscar no banco de dados do Fleetbase (MySQL) o Lojista associado a estas credenciais.
            // Simulando uma busca no banco que retorna a API Key da Organização no Fleetbase:
            logger_1.logger.info(`Validando credenciais para client_id: ${client_id}`);
            let fleetbaseApiKey = "";
            // Mock de validação: se o client_id for igual ao secret, consideramos válido para testes
            if (client_id && client_id === client_secret) {
                // Em produção, isso viria da tabela de Gateways/Integrações
                fleetbaseApiKey = `flb_live_${client_id}_mock_key`;
            }
            else {
                logger_1.logger.warn(`Falha de autenticação para client_id: ${client_id}`);
                return reply.status(401).send({ error: 'invalid_client' });
            }
            // Payload do JWT com dados da organização
            const tokenPayload = {
                sub: client_id,
                fleetbase_api_key: fleetbaseApiKey,
                // Open Delivery requires these standard fields
                aud: 'logistics_service',
                iss: 'fleetbase_order_gateway'
            };
            // Gerar JWT válido por 1 hora
            const token = server.jwt.sign(tokenPayload, { expiresIn: '1h' });
            return reply.send({
                access_token: token,
                token_type: 'bearer',
                expires_in: 3600
            });
        }
        catch (error) {
            logger_1.logger.error({ err: error }, 'Erro ao gerar token OAuth2');
            return reply.status(500).send({ error: 'server_error' });
        }
    });
};
exports.authRoutes = authRoutes;
