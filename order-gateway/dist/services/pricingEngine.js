"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingEngine = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
const axios_1 = __importDefault(require("axios"));
const mysql_1 = require("../mysql");
const logger_1 = require("../logger");
const config_1 = require("../config");
const redis = new ioredis_1.default(config_1.config.REDIS_URL);
class PricingEngine {
    /**
     * Resolve a Service Rate correta baseada no timestamp do pedido.
     */
    static async resolveRate(companyUuid, orderDate) {
        const rates = await this.getServiceRates(companyUuid);
        if (!rates || rates.length === 0) {
            return null;
        }
        const orderHour = orderDate.getHours();
        const orderMinutes = orderDate.getMinutes();
        const orderDayOfWeek = orderDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        // Seleção de Tarifa (Slot e Final de Semana)
        let selectedRate = rates[0]; // Padrão: pega a primeira
        for (const rate of rates) {
            const meta = rate.metadata || {};
            let isWeekendMatch = true;
            let isSlotMatch = true;
            // Regra 1: Weekend Days
            if (meta.weekend_days && Array.isArray(meta.weekend_days)) {
                if (!meta.weekend_days.includes(orderDayOfWeek)) {
                    isWeekendMatch = false;
                }
            }
            // Regra 2: Slot Trigger (Ex: "00:00" -> Madrugada)
            if (meta.slot_trigger) {
                const [triggerHour, triggerMinute] = meta.slot_trigger.split(':').map(Number);
                const triggerTime = triggerHour * 60 + triggerMinute;
                const orderTime = orderHour * 60 + orderMinutes;
                // Simplificado: Se o pedido aconteceu depois (ou exato) do slot_trigger
                if (orderTime < triggerTime) {
                    isSlotMatch = false;
                }
            }
            // Se ambas as regras baterem, selecionamos essa tarifa
            if (isWeekendMatch && isSlotMatch) {
                // Assume-se que as tarifas específicas vêm por último ou têm prioridade
                selectedRate = rate;
            }
        }
        return selectedRate;
    }
    /**
     * Busca as tarifas com Caching, API e Fallback para MySQL
     */
    static async getServiceRates(companyUuid) {
        const cacheKey = `service_rates_${companyUuid}`;
        // 1. Redis Cache
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        let rates = [];
        // 2. API (com Timeout de 200ms)
        try {
            const response = await axios_1.default.get(`http://expresso_neves_api:8000/v1/service-rates?company=${companyUuid}`, {
                timeout: 200, // Exigência de performance
                headers: {
                    'Authorization': `Bearer ${config_1.config.FLEETBASE_API_KEY}` // Em multitenant, usar a key específica
                }
            });
            rates = response.data;
        }
        catch (error) {
            logger_1.logger.warn({ err: error.message }, `API call for service rates failed or timed out for company ${companyUuid}. Falling back to MySQL.`);
            // 3. MySQL Fallback
            rates = await this.getRatesFromMySQL(companyUuid);
        }
        // Grava no cache por 1 Hora (3600 segundos)
        if (rates.length > 0) {
            await redis.set(cacheKey, JSON.stringify(rates), 'EX', 3600);
        }
        return rates;
    }
    /**
     * Busca direta no MySQL
     */
    static async getRatesFromMySQL(companyUuid) {
        let connection;
        try {
            connection = await (0, mysql_1.getDbConnection)();
            const [rows] = await connection.query('SELECT * FROM service_rates WHERE company_uuid = ? AND deleted_at IS NULL', [companyUuid]);
            const rates = rows.map(row => {
                let parsedMetadata = {};
                try {
                    // O Fleetbase guarda JSON no banco (seja stringificado ou como tipo JSON)
                    parsedMetadata = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
                }
                catch (e) {
                    logger_1.logger.error(e, 'Failed to parse metadata JSON');
                }
                return {
                    id: row.id,
                    uuid: row.uuid,
                    company_uuid: row.company_uuid,
                    service_type: row.service_type,
                    rate_name: row.name,
                    base_fee: parseFloat(row.base_fee) || 0,
                    per_km_flat_rate: parseFloat(row.per_km_flat_rate) || 0,
                    metadata: parsedMetadata
                };
            });
            return rates;
        }
        catch (error) {
            logger_1.logger.error(error, 'MySQL Service Rates fetch failed');
            return [];
        }
        finally {
            if (connection)
                connection.release();
        }
    }
}
exports.PricingEngine = PricingEngine;
