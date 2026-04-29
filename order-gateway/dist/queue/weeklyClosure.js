"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeeklyClosureService = void 0;
const mysql_1 = require("../mysql");
const logger_1 = require("../logger");
const asaas_1 = require("../services/asaas");
class WeeklyClosureService {
    /**
     * Executa o fechamento semanal de uma Organização
     */
    static async executeClosure(companyUuid, startDate, endDate) {
        logger_1.logger.info(`Starting Weekly Closure for company ${companyUuid} from ${startDate.toISOString()} to ${endDate.toISOString()}`);
        let connection;
        try {
            connection = await (0, mysql_1.getDbConnection)();
            // 1. Buscar Metadados da Organização (para obter Piso, Taxa de Supervisão e Customer ID)
            const [orgRows] = await connection.query('SELECT meta FROM companies WHERE uuid = ?', [companyUuid]);
            const orgMeta = orgRows[0]?.meta ?
                (typeof orgRows[0].meta === 'string' ? JSON.parse(orgRows[0].meta) : orgRows[0].meta)
                : {};
            const adminFloorOrders = orgMeta.admin_floor_orders || 0;
            const adminFloorValue = orgMeta.admin_floor_value || 0;
            const supervisionFee = orgMeta.supervision_fee || 100.00;
            const asaasCustomerId = orgMeta.asaas_customer_id; // Obrigatório para gerar cobrança
            // 2. Buscar Ordens Finalizadas da Semana no MySQL (agrupando por driver para repasse)
            const [orderRows] = await connection.query(`SELECT id, uuid, driver_assigned_uuid, meta 
         FROM orders 
         WHERE company_uuid = ? 
           AND status = 'completed' 
           AND created_at >= ? 
           AND created_at <= ?`, [companyUuid, startDate, endDate]);
            let totalOrders = 0;
            let realProductionStore = 0;
            let totalDriverPayouts = 0;
            const driverPayouts = {};
            for (const row of orderRows) {
                totalOrders++;
                let orderMeta = {};
                try {
                    orderMeta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {});
                }
                catch (e) {
                    logger_1.logger.warn(`Failed to parse meta for order ${row.uuid}`);
                }
                const financials = orderMeta.financials || {};
                const driverRate = financials.driver_rate || 0;
                const storeRate = financials.store_rate || 0;
                realProductionStore += storeRate;
                // Agrupa o repasse por motoboy
                if (row.driver_assigned_uuid) {
                    if (!driverPayouts[row.driver_assigned_uuid]) {
                        driverPayouts[row.driver_assigned_uuid] = 0;
                    }
                    driverPayouts[row.driver_assigned_uuid] += driverRate;
                }
            }
            // 3. Lógica do Piso Admin
            let appliedAdminFloor = 0;
            if (totalOrders > 0 && totalOrders < adminFloorOrders) {
                appliedAdminFloor = adminFloorValue;
                logger_1.logger.info(`Admin Floor Triggered! Orders: ${totalOrders} < ${adminFloorOrders}. Applying R$ ${appliedAdminFloor}`);
            }
            // 4. Fechamento Final (Loja)
            const totalStoreInvoice = realProductionStore + appliedAdminFloor + supervisionFee;
            let asaasChargeId = null;
            // 5. Gera Cobrança PIX para o Lojista no Asaas
            if (asaasCustomerId && totalStoreInvoice > 0) {
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 1);
                const formattedDueDate = dueDate.toISOString().split('T')[0];
                logger_1.logger.info(`Generating Asaas PIX Charge of R$ ${totalStoreInvoice} for Customer ${asaasCustomerId}`);
                const charge = await asaas_1.AsaasClient.createPixCharge(asaasCustomerId, totalStoreInvoice, `Fechamento Semanal Fleetbase (${startDate.toLocaleDateString()} a ${endDate.toLocaleDateString()}) - ${totalOrders} Pedidos`, formattedDueDate);
                asaasChargeId = charge.id;
            }
            else {
                logger_1.logger.warn(`Cannot generate PIX charge for company ${companyUuid}. Missing asaas_customer_id or total is 0.`);
            }
            // 6. Agenda Repasses PIX para os Motoboys via BullMQ (Resiliência)
            const driverPayoutResults = [];
            const driverUuids = Object.keys(driverPayouts);
            const endDateString = endDate.toISOString().split('T')[0];
            if (driverUuids.length > 0) {
                const [driverRows] = await connection.query(`SELECT uuid, meta FROM drivers WHERE uuid IN (?)`, [driverUuids]);
                for (const dRow of driverRows) {
                    let grossPayout = driverPayouts[dRow.uuid];
                    let dMeta = {};
                    try {
                        dMeta = typeof dRow.meta === 'string' ? JSON.parse(dRow.meta) : (dRow.meta || {});
                    }
                    catch (e) { }
                    // Dedução de Vales e Adiantamentos cadastrados no metadado do motorista
                    const valesDeduction = dMeta.vales || 0;
                    let netPayout = grossPayout - valesDeduction;
                    if (netPayout < 0)
                        netPayout = 0;
                    if (netPayout > 0) {
                        totalDriverPayouts += netPayout;
                        const pixKey = dMeta.pix_key;
                        const pixType = dMeta.pix_key_type;
                        if (pixKey && pixType) {
                            const idempotencyKey = `closure_${companyUuid}_${dRow.uuid}_${endDateString}`;
                            logger_1.logger.info(`Enqueuing PIX Transfer of R$ ${netPayout} to Driver ${dRow.uuid} (Vales deduzidos: R$ ${valesDeduction})`);
                            // Enfileira o pagamento em vez de bloquear o loop
                            // NOTA: Para funcionar, importe 'payoutQueue' no topo do arquivo.
                            const { payoutQueue } = require('./payoutQueue');
                            await payoutQueue.add('process_payout', {
                                companyUuid,
                                driverUuid: dRow.uuid,
                                amount: netPayout,
                                pixKey,
                                pixType,
                                idempotencyKey
                            });
                            driverPayoutResults.push({ driver: dRow.uuid, status: 'queued', amount: netPayout, vales_deducted: valesDeduction });
                        }
                        else {
                            driverPayoutResults.push({ driver: dRow.uuid, status: 'failed', error: 'Missing PIX key in metadata' });
                        }
                    }
                }
            }
            // 7. Lucro Bruto da Central
            const centralProfit = totalStoreInvoice - totalDriverPayouts;
            const closureReport = {
                company_uuid: companyUuid,
                period: { start: startDate, end: endDate },
                metrics: {
                    total_orders: totalOrders,
                    real_production_store: realProductionStore,
                },
                fees: {
                    applied_admin_floor: appliedAdminFloor,
                    supervision_fee: supervisionFee
                },
                totals: {
                    store_invoice: totalStoreInvoice,
                    driver_net_payouts: totalDriverPayouts,
                    central_profit: centralProfit,
                    driver_payout_jobs: driverPayoutResults
                },
                asaas: {
                    store_charge_id: asaasChargeId
                }
            };
            logger_1.logger.info(closureReport, 'Weekly Closure Completed');
            return closureReport;
        }
        catch (error) {
            logger_1.logger.error(error, 'Error executing weekly closure');
            throw error;
        }
        finally {
            if (connection)
                connection.release();
        }
    }
}
exports.WeeklyClosureService = WeeklyClosureService;
