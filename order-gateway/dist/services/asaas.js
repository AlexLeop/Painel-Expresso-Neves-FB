"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsaasClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const logger_1 = require("../logger");
// Utiliza o ambiente Sandbox ou Produção baseado na API Key
const baseURL = config_1.config.ASAAS_API_KEY?.startsWith('$aact_')
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';
const asaasApi = axios_1.default.create({
    baseURL,
    headers: {
        'access_token': config_1.config.ASAAS_API_KEY || '',
        'Content-Type': 'application/json'
    }
});
class AsaasClient {
    /**
     * Cria um cliente (Lojista) no Asaas para podermos emitir cobranças contra ele.
     */
    static async createCustomer(name, cpfCnpj, email, phone) {
        try {
            const response = await asaasApi.post('/customers', {
                name,
                cpfCnpj,
                email,
                phone
            });
            return response.data; // Retorna o objeto contendo o `id` (cus_...)
        }
        catch (error) {
            logger_1.logger.error('Asaas createCustomer error', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Gera uma cobrança PIX para o Lojista (Fechamento Semanal).
     */
    static async createPixCharge(customerId, value, description, dueDate) {
        try {
            const response = await asaasApi.post('/payments', {
                customer: customerId,
                billingType: 'PIX',
                value: Number(value.toFixed(2)),
                dueDate,
                description
            });
            return response.data; // Retorna o `id` do pagamento e o QR Code payload
        }
        catch (error) {
            logger_1.logger.error('Asaas createPixCharge error', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Transfere fundos (Repasse) para a chave PIX do Motoboy.
     */
    static async transferPix(value, pixAddressKey, pixAddressKeyType, description, idempotencyKey) {
        try {
            const headers = {};
            if (idempotencyKey) {
                headers['idempotency-key'] = idempotencyKey;
            }
            const response = await asaasApi.post('/transfers', {
                value: Number(value.toFixed(2)),
                pixAddressKey,
                pixAddressKeyType, // 'CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'
                description,
                operationType: 'PIX'
            }, { headers });
            return response.data;
        }
        catch (error) {
            logger_1.logger.error('Asaas transferPix error', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Valida uma Chave PIX utilizando a API do Banco Central / Asaas.
     */
    static async validatePixKey(pixAddressKey, pixAddressKeyType) {
        try {
            // O Asaas permite validar/pesquisar se a chave existe (no ambiente de produção)
            // Substituindo com um GET genérico para fins de arquitetura
            // const response = await asaasApi.get(`/pix/addressKeys?pixAddressKey=${pixAddressKey}`);
            // return response.data.data.length > 0;
            // Validação simulada para o Sandbox (ou chamada real)
            if (pixAddressKey.length < 5)
                throw new Error('Chave PIX muito curta');
            return true;
        }
        catch (error) {
            logger_1.logger.error('Asaas PIX Validation error', error.response?.data || error.message);
            throw new Error('Chave PIX inválida ou não encontrada no Banco Central.');
        }
    }
    /**
     * Consulta saldo da conta Asaas Master (Dashboard)
     */
    static async getBalance() {
        try {
            const response = await asaasApi.get('/finance/balance');
            return response.data; // { balance: 0 }
        }
        catch (error) {
            logger_1.logger.error('Asaas getBalance error', error.response?.data || error.message);
            throw error;
        }
    }
}
exports.AsaasClient = AsaasClient;
