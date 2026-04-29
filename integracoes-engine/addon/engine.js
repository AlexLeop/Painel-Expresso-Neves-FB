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
      'session',
      'current-user',
      'fetch',
      'socket',
      'media',
      'app-cache',
      'url-search-params',
      'modals-manager',
      'resource-context-panel',
      'custom-fields-registry',
      'table-context',
      'loader',
      'filters',
      'crud',
      'notifications',
      'fileQueue',
      'sidebar',
      'dashboard',
      'universe',
      'universe/menu-service',
      'universe/registry-service',
      'universe/hook-service',
      'universe/widget-service',
      'universe/extension-manager',
      'events',
      'intl',
      'abilities',
      'language',
      { hostRouter: 'router' },
    ],
  },
});

loadInitializers(IntegracoesEngine, modulePrefix);

export default IntegracoesEngine;
