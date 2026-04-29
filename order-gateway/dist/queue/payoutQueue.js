"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payoutQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const logger_1 = require("../logger");
const asaas_1 = require("../services/asaas");
const connection = new ioredis_1.default(config_1.config.REDIS_URL, {
    maxRetriesPerRequest: null
});
// Fila de pagamentos aos motoboys
exports.payoutQueue = new bullmq_1.Queue('payouts', { connection });
// Worker processa os pagamentos 1 por vez para não estourar rate limit
const payoutWorker = new bullmq_1.Worker('payouts', async (job) => {
    const { driverUuid, amount, pixKey, pixType, idempotencyKey } = job.data;
    logger_1.logger.info(`Processando repasse PIX - Driver: ${driverUuid} | R$: ${amount}`);
    try {
        // A chave de idempotência garante que a mesma ordem nunca seja paga duas vezes,
        // mesmo que o Asaas sofra instabilidade e o BullMQ tente novamente.
        const transfer = await asaas_1.AsaasClient.transferPix(amount, pixKey, pixType, 'Repasse Semanal Entregas Fleetbase', idempotencyKey);
        logger_1.logger.info(`Repasse concluído com sucesso. Transfer ID: ${transfer.id}`);
        return transfer;
    }
    catch (error) {
        const errorBody = error.response?.data || {};
        // Verifica se é erro de saldo insuficiente
        if (JSON.stringify(errorBody).includes('insufficient_balance')) {
            logger_1.logger.error(`SALDO INSUFICIENTE na conta master para o Motoboy ${driverUuid}. A fila tentará novamente em breve.`);
            // O throw garante que o BullMQ entenda que falhou e coloque na fila de retry
            throw new Error('insufficient_balance');
        }
        logger_1.logger.error(`Falha no repasse para o driver ${driverUuid}`, errorBody);
        throw error;
    }
}, {
    connection,
    concurrency: 2, // Limite de chamadas concorrentes ao Asaas para evitar Rate Limit
    limiter: {
        max: 10,
        duration: 1000 // Máximo de 10 requests por segundo
    }
});
payoutWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Repasse Job ${job?.id} failed with error ${err.message}`);
});
