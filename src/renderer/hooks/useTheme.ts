import { useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    // Verificar el tema guardado en localStorage
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    
    // Si hay un tema guardado, usarlo; si no, detectar preferencia del sistema
    if (savedTheme) {
      return savedTheme;
    } else {
      // Verificar preferencia del sistema
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  });

  useEffect(() => {
    // Actualizar la clase en el elemento HTML
    const root = window.document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Guardar el tema en localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Función para cambiar el tema
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return { theme, toggleTheme };
} 