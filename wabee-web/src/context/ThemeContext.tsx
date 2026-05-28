import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'light',
    setTheme: () => { },
    toggleTheme: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Inicializar desde las preferencias guardadas en localStorage
    const getInitialTheme = (): Theme => {
        const savedPrefs = localStorage.getItem('wabee_prefs');
        if (savedPrefs) {
            try {
                const prefs = JSON.parse(savedPrefs);
                if (prefs.theme === 'light' || prefs.theme === 'dark') return prefs.theme;
            } catch (_) { }
        }

        // Si no hay prefs, intentar deducir de wabee_user (preferencias del servidor cacheadas)
        const savedUser = localStorage.getItem('wabee_user');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                const theme = user.preferences?.theme;
                if (theme === 'light' || theme === 'dark') return theme;
            } catch (_) { }
        }

        return 'light';
    };

    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    const applyTheme = (t: Theme) => {
        const root = document.documentElement;
        if (t === 'light') {
            root.classList.add('light-theme');
        } else {
            root.classList.remove('light-theme');
        }
    };

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        applyTheme(t);
        // Persistir en localStorage (wabee_prefs es nuestra fuente de verdad local rápida)
        localStorage.setItem('wabee_prefs', JSON.stringify({ theme: t }));
    };

    const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
