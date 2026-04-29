import Model, { attr } from '@ember-data/model';

export default class IntegrationModel extends Model {
  @attr('string') name;
  @attr('string') provider; // e.g., 'open_delivery', 'ifood', 'asaas'
  @attr('string') status; // 'active', 'inactive'
  @attr('string') client_id;
  
  // O token gerado/api key
  @attr('string') api_key;
  
  // Campo solicitado: Logs de Erro Recentes
  @attr('string') last_error_log;
  @attr('date') last_error_at;
  
  // Datas de controle
  @attr('date') created_at;
  @attr('date') updated_at;
}
