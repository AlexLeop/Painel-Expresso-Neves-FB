export default {
    setupExtension(app, universe) {
        const menuService = universe.getService('menu');

        // Registra item no menu de navegação do header (barra superior)
        menuService.registerHeaderMenuItem('Financeiro', 'console.financeiro', {
            icon: 'money-bill-wave',
            priority: 101,
            description: 'Gestão financeira, contas a pagar e receber.',
        });
    },
};
