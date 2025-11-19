import { useState, useEffect } from 'react';
import { CompanySettings } from '../../types';

const DEFAULT_SETTINGS: CompanySettings = {
  name: 'C.O.M.P.A',
  taxId: '123456789-0',
  address: 'Calle Principal #123',
  phone: '(123) 456-7890',
  email: 'info@example.com',
  website: 'www.example.com',
  logoUrl: '',
  footerText: '©2025 - Todos los derechos reservados'
};

export const useCompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = () => {
      try {
        const savedSettings = localStorage.getItem('companySettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    
    // Escuchar cambios en localStorage (si los ajustes se actualizan en otra pestaña)
    window.addEventListener('storage', loadSettings);
    return () => {
      window.removeEventListener('storage', loadSettings);
    };
  }, []);

  return { settings, loading };
};

export default useCompanySettings; 