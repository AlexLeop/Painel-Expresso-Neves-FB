import ApplicationAdapter from '@fleetbase/ember-core/adapters/application';

export default class IntegrationAdapter extends ApplicationAdapter {
  /**
   * O namespace é prefixado com `/integracoes/int` para que o Nginx do Console
   * capture a request e faça o proxy_pass para o Order Gateway (porta 3000).
   */
  namespace = 'integracoes/int/v1';

  /**
   * Ajusta o host dinamicamente para usar o path relativo, 
   * garantindo que a request fique na mesma origem (evitando CORS).
   */
  get host() {
    return window.location.origin;
  }
}
