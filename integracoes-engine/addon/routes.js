import buildRoutes from 'ember-engines/routes';

export default buildRoutes(function () {
  // Rota principal que vai renderizar o catálogo
  this.route('catalogo', { path: '/' }, function () {
    // index is implicit
  });
});
