"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverAuthRoutes = void 0;
const asaas_1 = require("../../services/asaas");
const logger_1 = require("../../logger");
const mysql_1 = require("../../mysql");
const driverAuthRoutes = async (server) => {
    server.post('/register', async (request, reply) => {
        const { name, cpf, email, phone, pixKey, pixType, companyUuid } = request.body;
        try {
            // 1. Validação Real da Chave PIX (Anti-fraude e Anti-erros)
            await asaas_1.AsaasClient.validatePixKey(pixKey, pixType);
            // 2. Injeta Driver no MySQL (Simulando API FleetOps para economizar chamadas no BFF)
            // Em produção real com FleetOps puro, faríamos um POST HTTP para o FleetOps
            // Aqui vamos salvar direto no MySQL para performance, com status = 'pending'
            const connection = await (0, mysql_1.getDbConnection)();
            const driverUuid = `driver_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const metaJSON = JSON.stringify({
                pix_key: pixKey,
                pix_key_type: pixType,
                source: 'navigator_app_onboarding'
            });
            await connection.query(`INSERT INTO drivers (uuid, company_uuid, name, phone, email, status, meta, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW(), NOW())`, [driverUuid, companyUuid, name, phone, email, metaJSON]);
            connection.release();
            logger_1.logger.info(`Driver ${name} registered successfully. Status: PENDING.`);
            // 3. Gerar JWT Session
            const token = server.jwt.sign({
                uuid: driverUuid,
                company_uuid: companyUuid,
                status: 'pending'
            });
            return reply.send({
                token,
                driver: {
                    uuid: driverUuid,
                    name,
                    status: 'pending'
                },
                message: 'Conta em análise. Aguarde a aprovação da central.'
            });
        }
        catch (error) {
            logger_1.logger.error('Driver Onboarding Error', error);
            return reply.status(400).send({ error: error.message || 'Falha ao registrar motorista' });
        }
    });
};
exports.driverAuthRoutes = driverAuthRoutes;
