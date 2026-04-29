"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetbaseWebhookRoutes = void 0;
const logger_1 = require("../../logger");
const mysql_1 = require("../../mysql");
const fleetbaseWebhookRoutes = async (server) => {
    server.post('/fleetbase', async (request, reply) => {
        const { event, data } = request.body;
        logger_1.logger.info(`Recebido Webhook do Fleetbase: ${event}`);
        try {
            if (event === 'driver.updated') {
                const driverUuid = data.uuid;
                const newStatus = data.status;
                // Se o motorista mudou para active, injetamos a Data de Ativação
                // Isso é o coração da segurança jurídica do fechamento (não repassar retroativo indevido)
                if (newStatus === 'active') {
                    const connection = await (0, mysql_1.getDbConnection)();
                    // Busca o metadata atual
                    const [rows] = await connection.query('SELECT meta FROM drivers WHERE uuid = ?', [driverUuid]);
                    let meta = {};
                    if (rows[0]) {
                        try {
                            meta = typeof rows[0].meta === 'string' ? JSON.parse(rows[0].meta) : (rows[0].meta || {});
                        }
                        catch (e) { }
                    }
                    // Só registrar se ainda não tiver data de ativação
                    if (!meta.activation_date) {
                        meta.activation_date = new Date().toISOString();
                        await connection.query('UPDATE drivers SET meta = ? WHERE uuid = ?', [JSON.stringify(meta), driverUuid]);
                        logger_1.logger.info(`Motorista ${driverUuid} ativado! Timestamp de ativação salvo no meta.`);
                        // TODO: Aqui pode entrar a Rotina de Sequência de Boas-Vindas (Twilio/Sendgrid SMS)
                        // sendWelcomeSMS(data.phone, data.name);
                    }
                    connection.release();
                }
            }
            return reply.send({ success: true });
        }
        catch (error) {
            logger_1.logger.error(error, 'Webhook processing error');
            return reply.status(500).send({ error: 'Webhook falhou' });
        }
    });
};
exports.fleetbaseWebhookRoutes = fleetbaseWebhookRoutes;
