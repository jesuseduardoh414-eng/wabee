/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                page: "var(--bg-page)",
                surface: "var(--bg-surface)",
                card: "var(--bg-card)",
                elevated: "var(--bg-elevated)",
                input: "var(--bg-input)",
                hover: "var(--bg-hover)",
                selected: "var(--bg-selected)",

                strong: "var(--text-strong)",
                body: "var(--text-body)",
                muted: "var(--text-muted)",
                inverse: "var(--text-inverse)",

                brand: "var(--brand-primary)",
                "brand-foreground": "var(--brand-primary-foreground)",

                "status-success": "var(--state-success)",
                "status-warning": "var(--state-warning)",
                "status-danger": "var(--state-danger)",
                "status-info": "var(--state-info)",

                chart: {
                    1: "var(--chart-1)",
                    2: "var(--chart-2)",
                    3: "var(--chart-3)",
                    4: "var(--chart-4)",
                    5: "var(--chart-5)",
                    grid: "var(--chart-grid)",
                    axis: "var(--chart-axis)",
                    'tooltip-bg': "var(--chart-tooltip-bg)",
                    'tooltip-text': "var(--chart-tooltip-text)",
                }
            },
            borderColor: ({ theme }) => ({
                ...theme('colors'),
                DEFAULT: "var(--border-default)",
                strong: "var(--border-strong)",
                focus: "var(--border-focus)",
            }),
            ringColor: ({ theme }) => ({
                ...theme('colors'),
                DEFAULT: "var(--border-focus)",
            })
        },
    },
    plugins: [],
}
