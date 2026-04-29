import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class CatalogoIndexRoute extends Route {
  @service store;

  /**
   * Dispara o GET /integracoes/int/v1/integrations via Ember Data
   */
  model() {
    return this.store.findAll('integration');
  }
}
