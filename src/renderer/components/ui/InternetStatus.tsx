import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

// Umbral de tiempo de respuesta que consideramos "lento" (en ms)
const LATENCY_THRESHOLD = 1000;
// Intervalo entre pruebas (en ms): 10 minutos
const CHECK_INTERVAL = 600000;
// URL para verificar conectividad (endpoint ligero)
const CHECK_URL = 'https://www.google.com/generate_204';

const InternetStatus: React.FC = () => {
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');
  const [lastToastId, setLastToastId] = useState<string | null>(null);

  // Función para verificar la calidad de la conexión
  const checkConnectionQuality = useCallback(async () => {
    if (!navigator.onLine) {
      if (connectionQuality !== 'offline') {
        setConnectionQuality('offline');
        const id = toast.error('Conexión a internet perdida', { 
          id: 'connection-offline',
          duration: 5000 
        });
        setLastToastId(id);
      }
      return;
    }

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      
      // Establecer un timeout para la petición
      const timeoutId = setTimeout(() => controller.abort(), LATENCY_THRESHOLD);
      
      try {
        await fetch(CHECK_URL, { 
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const endTime = Date.now();
        const latency = endTime - startTime;
        
        // Determinar la calidad basada en la latencia
        if (latency > LATENCY_THRESHOLD) {
          if (connectionQuality !== 'poor') {
            setConnectionQuality('poor');
            const id = toast.error('Conexión a internet inestable', { 
              id: 'connection-poor',
              duration: 5000 
            });
            setLastToastId(id);
          }
        } else {
          if (connectionQuality !== 'good') {
            setConnectionQuality('good');
            if (lastToastId) {
              const id = toast.success('Conexión a internet restablecida', { 
                id: 'connection-good',
                duration: 3000 
              });
              setLastToastId(id);
            }
          }
        }
      } catch (error) {
        clearTimeout(timeoutId);
        // Si hay timeout u otro error, consideramos la conexión pobre
        if (connectionQuality !== 'poor') {
          setConnectionQuality('poor');
          const id = toast.error('Conexión a internet inestable', { 
            id: 'connection-poor',
            duration: 5000 
          });
          setLastToastId(id);
        }
      }
    } catch (error) {
      console.error('Error comprobando la calidad de la conexión:', error);
    }
  }, [connectionQuality, lastToastId]);

  useEffect(() => {
    // Manejadores para detectar cambios en la conexión
    const handleOnline = () => {
      checkConnectionQuality();
    };
    
    const handleOffline = () => {
      setConnectionQuality('offline');
      const id = toast.error('Conexión a internet perdida', { 
        id: 'connection-offline',
        duration: 5000 
      });
      setLastToastId(id);
    };

    // Comprobar estado inicial
    checkConnectionQuality();

    // Agregar escuchadores de eventos
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Configurar comprobaciones periódicas (solo cuando está online)
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        checkConnectionQuality();
      }
    }, CHECK_INTERVAL);

    // Función de limpieza
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkConnectionQuality]);

  return (
    <div className="flex items-center" title={
      connectionQuality === 'good' 
        ? 'Conexión a internet estable' 
        : connectionQuality === 'poor' 
          ? 'Conexión a internet inestable' 
          : 'Sin conexión a internet'
    }>
      <div className="relative">
        <div 
          className={`h-3 w-3 rounded-full ${
            connectionQuality === 'good' 
              ? 'bg-green-500' 
              : connectionQuality === 'poor' 
                ? 'bg-yellow-500' 
                : 'bg-red-500'
          }`}
        ></div>
        {connectionQuality === 'good' && (
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500 animate-ping opacity-75"></div>
        )}
        {connectionQuality === 'poor' && (
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-yellow-500 animate-pulse opacity-75"></div>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden md:inline ml-2">
        {connectionQuality === 'good' 
          ? 'Conectado' 
          : connectionQuality === 'poor' 
            ? 'Inestable' 
            : 'Sin conexión'}
      </span>
    </div>
  );
};

export default InternetStatus; 