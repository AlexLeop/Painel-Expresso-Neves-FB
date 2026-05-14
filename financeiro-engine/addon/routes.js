import buildRoutes from 'ember-engines/routes';

export default buildRoutes(function () {
    this.route('home', { path: '/' });
    this.route('escalas', function () {
        this.route('index', { path: '/' });
    });
    this.route('lancamentos', function () {
        this.route('index', { path: '/' });
    });
    this.route('calculo', function () {
        this.route('index', { path: '/' });
    });
    this.route('creditos', function () {
        this.route('index', { path: '/' });
    });
    this.route('taxas', function () {
        this.route('index', { path: '/' });
    });
});
