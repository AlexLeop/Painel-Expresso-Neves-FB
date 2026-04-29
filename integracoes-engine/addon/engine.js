import Engine from '@ember/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';
import services from '@fleetbase/ember-core/exports/services';

const { modulePrefix } = config;
const externalRoutes = ['console', 'extensions'];

export default class IntegracoesEngine extends Engine {
    modulePrefix = modulePrefix;
    Resolver = Resolver;
    dependencies = {
        services,
        externalRoutes,
    };

    setupExtension = function (app, engine, universe) {
        // Registra item "Integrações" no menu de navegação do header
        universe.registerHeaderMenuItem('Integrações', 'console.integracoes', {
            icon: 'plug',
            priority: 100,
        });
    };
}

loadInitializers(IntegracoesEngine, modulePrefix);
