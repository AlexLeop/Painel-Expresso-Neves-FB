import Engine from '@ember/engine';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';
import config from './config/environment';
import services from '@fleetbase/ember-core/exports/services';

const { modulePrefix } = config;
const externalRoutes = ['console', 'extensions'];

export default class FinanceiroEngine extends Engine {
    modulePrefix = modulePrefix;
    Resolver = Resolver;
    dependencies = {
        services,
        externalRoutes,
    };

    setupExtension = function (app, engine, universe) {
        // Registra item "Financeiro" no menu de navegação do header
        universe.registerHeaderMenuItem('Financeiro', 'console.financeiro', {
            icon: 'money-bill-wave',
            priority: 101,
        });
    };
}

loadInitializers(FinanceiroEngine, modulePrefix);
