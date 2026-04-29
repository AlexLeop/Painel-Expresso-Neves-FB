"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFleetbaseOrder = exports.fleetOpsClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const logger_1 = require("../logger");
/**
 * Cliente de API para comunicação com o FleetOps interno (via rede Docker).
 */
exports.fleetOpsClient = axios_1.default.create({
    baseURL: `${config_1.config.FLEETBASE_API_URL}/v1`,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});
/**
 * Cria uma ordem no Fleetbase usando a chave da API (garantindo o multi-tenant).
 */
const createFleetbaseOrder = async (fleetbaseApiKey, orderPayload) => {
    try {
        const response = await exports.fleetOpsClient.post('/orders', orderPayload, {
            headers: {
                'Authorization': `Bearer ${fleetbaseApiKey}`
            }
        });
        return response.data;
    }
    catch (error) {
        logger_1.logger.error({
            err: error.message,
            response: error.response?.data,
            status: error.response?.status
        }, 'Erro ao criar ordem no FleetOps');
        throw error;
    }
};
exports.createFleetbaseOrder = createFleetbaseOrder;
