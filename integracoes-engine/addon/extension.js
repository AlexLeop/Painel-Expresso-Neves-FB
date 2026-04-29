export default {
    setupExtension(app, universe) {
        const menuService = universe.getService('menu');

        // Registra item no menu de navegação do header (barra superior)
        menuService.registerHeaderMenuItem('Integrações', 'console.integracoes', {
            icon: 'plug',
            priority: 100,
            description: 'Gerenciamento de integrações com parceiros White Label.',
        });
    },
};
