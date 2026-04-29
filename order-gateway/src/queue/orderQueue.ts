import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../logger';
import { normalizeOpenDeliveryToFleetbase } from '../normalizer/open-delivery';
import { createFleetbaseOrder } from '../services/fleetops';
import { PricingEngine } from '../services/pricingEngine';

const connection = new IORedis(config.REDIS_URL, {
    maxRetriesPerRequest: null
});

export const orderQueue = new Queue('orderQueue', { connection });

const orderWorker = new Worker('orderQueue', async (job: Job) => {
  logger.info(`Processing job ${job.id} of type ${job.name}`);
  const { payload, fleetbase_api_key, tenantId } = job.data;
  
  try {
    // 0. Resolve Pricing Rules
    const orderDate = new Date();
    const serviceRate = await PricingEngine.resolveRate(tenantId, orderDate);
    
    let driverRate = 0;
    let storeRate = 0;
    let serviceRateId = null;

    if (serviceRate && serviceRate.metadata) {
       driverRate = serviceRate.metadata.daily_rate_driver || 0;
       storeRate = serviceRate.metadata.daily_rate_store || 0;
       serviceRateId = serviceRate.uuid;
    }

    // 1. Normalizar o payload Open Delivery para o formato Fleetbase JSON:API
    const normalizedPayload = normalizeOpenDeliveryToFleetbase({
      ...payload,
      meta: {
        ...(payload.meta || {}),
        source: 'open_delivery',
        financials: {
          driver_rate: driverRate,
          store_rate: storeRate,
          service_rate_id: serviceRateId
        }
      }
    });
    
    logger.debug({ normalizedPayload }, 'Payload normalizado para Fleetbase');

    // 2. Chamar a API interna do Fleetbase passando a chave multi-tenant
    const result = await createFleetbaseOrder(fleetbase_api_key, normalizedPayload);
    
    logger.info({ order_id: result?.data?.id }, `Order criada com sucesso no Fleetbase`);

    return { status: 'success', fleetbase_order_id: result?.data?.id };
  } catch (error: any) {
    logger.error({ err: error.message }, `Falha ao processar job ${job.id}`);
    throw error; // Re-throw to let BullMQ handle retries
  }
}, { connection });

orderWorker.on('completed', job => {
  logger.info(`Job ${job.id} has completed successfully`);
});

orderWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} has failed with error: ${err.message}`);
});
