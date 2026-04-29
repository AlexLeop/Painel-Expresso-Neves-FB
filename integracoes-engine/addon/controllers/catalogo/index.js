import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class CatalogoIndexController extends Controller {
  searchQuery = '';

  @action
  configureIntegration(integration) {
    // Ação para abrir modal ou navegar para edição
    console.log(`Configuring integration: ${integration.name}`);
    // Exemplo de uso de modal manager nativo se estiver disponível
    // this.modalsManager.show('modals/configure-integration', { integration });
  }
}
