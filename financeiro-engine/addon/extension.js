export default {
    setupExtension(app, universe) {
        const menuService = universe.getService('universe/menu-service');

        // Register Financeiro in the console header navigation
        menuService.registerHeaderMenuItem('Financeiro', 'console.financeiro', {
            icon: 'money-bill-wave',
            priority: 5,
            description: 'Gestão financeira de motoboys — escalas, lançamentos, cálculos e taxas.',
            shortcuts: [
                {
                    title: 'Escalas',
                    description: 'Gerenciar escalas de trabalho dos motoboys.',
                    icon: 'calendar-alt',
                    route: 'console.financeiro.escalas',
                },
                {
                    title: 'Lançamentos',
                    description: 'Registrar lançamentos financeiros.',
                    icon: 'file-invoice-dollar',
                    route: 'console.financeiro.lancamentos',
                },
                {
                    title: 'Cálculo Semanal',
                    description: 'Calcular pagamento semanal por motoboy.',
                    icon: 'calculator',
                    route: 'console.financeiro.calculo',
                },
                {
                    title: 'Créditos',
                    description: 'Gerenciar créditos dos motoboys.',
                    icon: 'hand-holding-usd',
                    route: 'console.financeiro.creditos',
                },
                {
                    title: 'Taxas',
                    description: 'Configurar taxas e valores.',
                    icon: 'percentage',
                    route: 'console.financeiro.taxas',
                },
            ],
        });
    },
};
