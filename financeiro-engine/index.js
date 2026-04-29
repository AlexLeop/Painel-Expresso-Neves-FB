'use strict';

const EngineAddon = require('ember-engines/lib/engine-addon');

module.exports = EngineAddon.extend({
  name: '@fleetbase/financeiro-engine',
  lazyLoading: {
    enabled: true
  },
  isDevelopingAddon() {
    return true;
  }
});
