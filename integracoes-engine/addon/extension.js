import { getOwner } from '@ember/application';

export default class IntegracoesExtension {
  static name = 'integracoes';

  constructor(owner) {
    this.owner = owner;
  }

  /**
   * Ponto de injeção da extensão no Console do Fleetbase.
   * Adiciona o item ao menu principal (sidebar/header).
   */
  invoke() {
    const universe = getOwner(this.owner).lookup('service:universe');

    // Registra o item no menu de navegação
    universe.registerMenuItem('Integrações', {
      icon: 'plug', // FontAwesome icon do design system nativo
      route: 'integracoes', // Rota que o Engine irá interceptar
      component: 'integracoes-engine' 
    });

    // Registra a rota principal do Engine no host router (Console)
    universe.registerEngine('integracoes', '@fleetbase/integracoes-engine');
  }
}
