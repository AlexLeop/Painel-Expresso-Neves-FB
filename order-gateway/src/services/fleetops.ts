import axios from 'axios';
import { config } from '../config';
import { logger } from '../logger';

/**
 * Cliente de API para comunicação com o FleetOps interno (via rede Docker).
 */
export const fleetOpsClient = axios.create({
  baseURL: `${config.FLEETBASE_API_URL}/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Cria uma ordem no Fleetbase usando a chave da API (garantindo o multi-tenant).
 */
export const createFleetbaseOrder = async (fleetbaseApiKey: string, orderPayload: any) => {
  try {
    const response = await fleetOpsClient.post('/orders', orderPayload, {
      headers: {
        'Authorization': `Bearer ${fleetbaseApiKey}`
      }
    });
    
    return response.data;
  } catch (error: any) {
    logger.error({ 
      err: error.message, 
      response: error.response?.data,
      status: error.response?.status
    }, 'Erro ao criar ordem no FleetOps');
    
    throw error;
  }
};
