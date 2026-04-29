import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';
import { AsaasClient } from '../services/asaas';

const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null
});

// Fila de pagamentos aos motoboys
export const payoutQueue = new Queue('payouts', { connection });

// Worker processa os pagamentos 1 por vez para não estourar rate limit
const payoutWorker = new Worker('payouts', async (job: Job) => {
  const { driverUuid, amount, pixKey, pixType, idempotencyKey } = job.data;
  
  logger.info(`Processando repasse PIX - Driver: ${driverUuid} | R$: ${amount}`);

  try {
    // A chave de idempotência garante que a mesma ordem nunca seja paga duas vezes,
    // mesmo que o Asaas sofra instabilidade e o BullMQ tente novamente.
    const transfer = await AsaasClient.transferPix(
      amount,
      pixKey,
      pixType,
      'Repasse Semanal Entregas Fleetbase',
      idempotencyKey
    );

    logger.info(`Repasse concluído com sucesso. Transfer ID: ${transfer.id}`);
    return transfer;

  } catch (error: any) {
    const errorBody = error.response?.data || {};
    // Verifica se é erro de saldo insuficiente
    if (JSON.stringify(errorBody).includes('insufficient_balance')) {
      logger.error(`SALDO INSUFICIENTE na conta master para o Motoboy ${driverUuid}. A fila tentará novamente em breve.`);
      // O throw garante que o BullMQ entenda que falhou e coloque na fila de retry
      throw new Error('insufficient_balance');
    }
    
    logger.error(`Falha no repasse para o driver ${driverUuid}`, errorBody);
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
  logger.error(`Repasse Job ${job?.id} failed with error ${err.message}`);
});
