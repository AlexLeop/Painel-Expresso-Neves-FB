"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.financeiroApiRoutes = void 0;
const asaas_1 = require("../../services/asaas");
const logger_1 = require("../../logger");
const financeiroApiRoutes = async (server) => {
    server.get('/v1/dashboard', async (request, reply) => {
        try {
            // 1. Busca Saldo Real no Asaas
            const balanceData = await asaas_1.AsaasClient.getBalance();
            // 2. Mock de dados consolidados (Futuramente virão do MySQL agregando a semana atual)
            const mockMetrics = {
                total_production: 12500.00,
                pending_transfers: 8200.00, // Repasses agendados aos motoboys
                net_revenue: 4300.00, // Lucro bruto (Spread + Taxas de Supervisão)
            };
            return {
                data: {
                    type: 'dashboard',
                    id: 'dashboard-metrics',
                    attributes: {
                        asaas_balance: balanceData.balance || 0,
                        ...mockMetrics,
                        updated_at: new Date().toISOString()
                    }
                }
            };
        }
        catch (error) {
            logger_1.logger.error(error, 'Error fetching dashboard metrics');
            return reply.status(500).send({ error: 'Failed to fetch financial metrics' });
        }
    });
};
exports.financeiroApiRoutes = financeiroApiRoutes;
