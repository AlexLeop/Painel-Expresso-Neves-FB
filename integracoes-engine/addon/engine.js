import Engine from 'ember-engines/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';

const { modulePrefix } = config;

const IntegracoesEngine = Engine.extend({
  modulePrefix,
  Resolver,
  dependencies: {
    services: [
      'store',
      'router',
      'host-router',
      'modals-manager',
      'notifications',
      'intl',
      'fetch',
    ],
  },
});

loadInitializers(IntegracoesEngine, modulePrefix);

export default IntegracoesEngine;
