import buildRoutes from 'ember-engines/routes';

export default buildRoutes(function() {
  this.route('financeiro', { path: '/' }, function() {
    this.route('dashboard', { path: '/' });
    this.route('motoristas', { path: '/motoristas' });
  });
});
