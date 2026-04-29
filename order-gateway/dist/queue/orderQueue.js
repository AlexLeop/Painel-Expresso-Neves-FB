"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderQueue = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const config_1 = require("../config");
const logger_1 = require("../logger");
const open_delivery_1 = require("../normalizer/open-delivery");
const fleetops_1 = require("../services/fleetops");
const pricingEngine_1 = require("../services/pricingEngine");
const connection = new ioredis_1.default(config_1.config.REDIS_URL, {
    maxRetriesPerRequest: null
});
exports.orderQueue = new bullmq_1.Queue('orderQueue', { connection });
const orderWorker = new bullmq_1.Worker('orderQueue', async (job) => {
    logger_1.logger.info(`Processing job ${job.id} of type ${job.name}`);
    const { payload, fleetbase_api_key, tenantId } = job.data;
    try {
        // 0. Resolve Pricing Rules
        const orderDate = new Date();
        const serviceRate = await pricingEngine_1.PricingEngine.resolveRate(tenantId, orderDate);
        let driverRate = 0;
        let storeRate = 0;
        let serviceRateId = null;
        if (serviceRate && serviceRate.metadata) {
            driverRate = serviceRate.metadata.daily_rate_driver || 0;
            storeRate = serviceRate.metadata.daily_rate_store || 0;
            serviceRateId = serviceRate.uuid;
        }
        // 1. Normalizar o payload Open Delivery para o formato Fleetbase JSON:API
        const normalizedPayload = (0, open_delivery_1.normalizeOpenDeliveryToFleetbase)({
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
        logger_1.logger.debug({ normalizedPayload }, 'Payload normalizado para Fleetbase');
        // 2. Chamar a API interna do Fleetbase passando a chave multi-tenant
        const result = await (0, fleetops_1.createFleetbaseOrder)(fleetbase_api_key, normalizedPayload);
        logger_1.logger.info({ order_id: result?.data?.id }, `Order criada com sucesso no Fleetbase`);
        return { status: 'success', fleetbase_order_id: result?.data?.id };
    }
    catch (error) {
        logger_1.logger.error({ err: error.message }, `Falha ao processar job ${job.id}`);
        throw error; // Re-throw to let BullMQ handle retries
    }
}, { connection });
orderWorker.on('completed', job => {
    logger_1.logger.info(`Job ${job.id} has completed successfully`);
});
orderWorker.on('failed', (job, err) => {
    logger_1.logger.error(`Job ${job?.id} has failed with error: ${err.message}`);
});
