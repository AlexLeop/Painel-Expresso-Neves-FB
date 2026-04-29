import Redis from 'ioredis';
import axios from 'axios';
import { getDbConnection } from '../mysql';
import { logger } from '../logger';
import { config } from '../config';

const redis = new Redis(config.REDIS_URL);

interface ServiceRateMetadata {
  daily_rate_store?: number;
  daily_rate_driver?: number;
  weekend_days?: number[];
  slot_trigger?: string; // e.g., "00:00"
}

export interface ServiceRate {
  id: string;
  uuid: string;
  company_uuid: string;
  service_type: string;
  rate_name: string;
  base_fee: number;
  per_km_flat_rate: number;
  metadata: ServiceRateMetadata;
}

export class PricingEngine {
  /**
   * Resolve a Service Rate correta baseada no timestamp do pedido.
   */
  static async resolveRate(companyUuid: string, orderDate: Date): Promise<ServiceRate | null> {
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
  private static async getServiceRates(companyUuid: string): Promise<ServiceRate[]> {
    const cacheKey = `service_rates_${companyUuid}`;
    
    // 1. Redis Cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let rates: ServiceRate[] = [];

    // 2. API (com Timeout de 200ms)
    try {
      const response = await axios.get(`http://expresso_neves_api:8000/v1/service-rates?company=${companyUuid}`, {
        timeout: 200, // Exigência de performance
        headers: {
          'Authorization': `Bearer ${config.FLEETBASE_API_KEY}` // Em multitenant, usar a key específica
        }
      });
      rates = response.data;
    } catch (error: any) {
      logger.warn({ err: error.message }, `API call for service rates failed or timed out for company ${companyUuid}. Falling back to MySQL.`);
      
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
  private static async getRatesFromMySQL(companyUuid: string): Promise<ServiceRate[]> {
    let connection;
    try {
      connection = await getDbConnection();
      const [rows] = await connection.query(
        'SELECT * FROM service_rates WHERE company_uuid = ? AND deleted_at IS NULL',
        [companyUuid]
      );
      
      const rates: ServiceRate[] = (rows as any[]).map(row => {
        let parsedMetadata = {};
        try {
          // O Fleetbase guarda JSON no banco (seja stringificado ou como tipo JSON)
          parsedMetadata = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
        } catch (e: any) {
          logger.error(e, 'Failed to parse metadata JSON');
        }

        return {
          id: row.id,
          uuid: row.uuid,
          company_uuid: row.company_uuid,
          service_type: row.service_type,
          rate_name: row.name,
          base_fee: parseFloat(row.base_fee) || 0,
          per_km_flat_rate: parseFloat(row.per_km_flat_rate) || 0,
          metadata: parsedMetadata as ServiceRateMetadata
        };
      });

      return rates;
    } catch (error: any) {
      logger.error(error, 'MySQL Service Rates fetch failed');
      return [];
    } finally {
      if (connection) connection.release();
    }
  }
}
