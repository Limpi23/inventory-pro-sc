import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { Button } from './button';

// Intervalo entre pruebas (en ms): 10 minutos
const CHECK_INTERVAL = 600000;
// Timeout para la prueba de conexión (en ms)
const CONNECTION_TIMEOUT = 5000;
// Intentos de reconexión (en ms): 1 minuto (igual que el CHECK_INTERVAL)
const RECONNECT_INTERVAL = 60000;

const DatabaseStatus: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'error'>('connected');
  const [lastToastId, setLastToastId] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Función para verificar la conexión a la base de datos
  const checkDatabaseConnection = useCallback(async (isManualCheck = false) => {
    if (isManualCheck) {
      setIsReconnecting(true);
    }
    
    try {
      // Utilizar AbortController para controlar el timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);
      
      // Consulta aún más liviana: select 1
      const { error } = await supabase
        .rpc('select_one'); // Debes crear una función RPC en tu base de datos que haga SELECT 1
      
      clearTimeout(timeoutId);
      
      if (error) {
        console.error('Error de conexión a la base de datos:', error.message);
        if (connectionStatus !== 'error' || isManualCheck) {
          setConnectionStatus('error');
          const id = toast.error(`Error de conexión a la base de datos: ${error.message}`, {
            id: 'db-connection-error',
            duration: 5000
          });
          setLastToastId(id);
          // Iniciar los intentos de reconexión
          if (reconnectAttempts === 0) {
            setReconnectAttempts(1);
          }
        }
      } else {
        if (connectionStatus !== 'connected' || isManualCheck) {
          setConnectionStatus('connected');
          // Resetear los intentos de reconexión
          setReconnectAttempts(0);
          
          const id = toast.success('Conexión a la base de datos restablecida', {
            id: 'db-connection-good',
            duration: 3000
          });
          setLastToastId(id);
        }
      }
    } catch (error: any) {
      console.error('Error comprobando la conexión a la base de datos:', error);
      if (connectionStatus !== 'error' || isManualCheck) {
        setConnectionStatus('error');
        const id = toast.error(`Error de conexión a la base de datos: ${error?.message || 'Error desconocido'}`, {
          id: 'db-connection-error',
          duration: 5000
        });
        setLastToastId(id);
        // Iniciar los intentos de reconexión
        if (reconnectAttempts === 0) {
          setReconnectAttempts(1);
        }
      }
    } finally {
      if (isManualCheck) {
        setIsReconnecting(false);
      }
    }
  }, [connectionStatus, lastToastId, reconnectAttempts]);

  // Función para manejar la reconexión manual
  const handleManualReconnect = useCallback(() => {
    checkDatabaseConnection(true);
  }, [checkDatabaseConnection]);

  // Efecto para la reconexión automática
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout | null = null;
    
    if (connectionStatus === 'error' && reconnectAttempts > 0) {
      console.log(`Intentando reconectar a la base de datos (intento ${reconnectAttempts})...`);
      
      reconnectTimer = setTimeout(() => {
        checkDatabaseConnection();
        // Incrementar contador de intentos
        setReconnectAttempts(prev => prev + 1);
      }, RECONNECT_INTERVAL);
    }
    
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [connectionStatus, reconnectAttempts, checkDatabaseConnection]);

  useEffect(() => {
    // Comprobar estado inicial
    checkDatabaseConnection();
    // Configurar comprobaciones periódicas SOLO si la ventana está activa
    const intervalId = setInterval(() => {
      if (connectionStatus === 'connected' && document.visibilityState === 'visible') {
        checkDatabaseConnection();
      }
    }, CHECK_INTERVAL);
    // Listener para detectar cuando la ventana se activa
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDatabaseConnection();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    // Limpieza
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [checkDatabaseConnection, connectionStatus]);

  return (
    <div className="flex items-center" title={
      connectionStatus === 'connected'
        ? 'Conectado a la base de datos'
        : `Error de conexión a la base de datos${reconnectAttempts > 0 ? ` (Reconectando: intento ${reconnectAttempts})` : ''}`
    }>
      <div className="relative">
        <div
          className={`h-3 w-3 rounded-full ${
            connectionStatus === 'connected'
              ? 'bg-green-500'
              : 'bg-red-500'
          }`}
        ></div>
        {connectionStatus === 'connected' && (
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500 animate-ping opacity-75"></div>
        )}
        {connectionStatus === 'error' && reconnectAttempts > 0 && (
          <div className="absolute inset-0 h-3 w-3 rounded-full bg-red-500 animate-pulse opacity-75"></div>
        )}
      </div>
      <span className="text-xs text-muted-foreground hidden md:inline ml-2">
        {connectionStatus === 'connected'
          ? 'BD Conectada'
          : reconnectAttempts > 0 
            ? `Reconectando...` 
            : 'BD Desconectada'}
      </span>
      
      {connectionStatus === 'error' && (
        <Button 
          variant="ghost" 
          size="icon"
          className="ml-1 h-6 w-6" 
          onClick={handleManualReconnect}
          disabled={isReconnecting}
          title="Forzar reconexión a la base de datos"
        >
          <i className={`fas fa-sync-alt ${isReconnecting ? 'animate-spin' : ''}`}></i>
        </Button>
      )}
    </div>
  );
};

export default DatabaseStatus; 