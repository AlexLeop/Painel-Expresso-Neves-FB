import Engine from '@ember/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';

const { modulePrefix } = config;

export default class IntegracoesEngine extends Engine {
  modulePrefix = modulePrefix;
  Resolver = Resolver;
  
  dependencies = {
    services: [
      'store',
      'router',
      'host-router',
      'modals-manager',
      'notifications',
      'intl',
      'fetch',
    ],
  };
}

loadInitializers(IntegracoesEngine, modulePrefix);
