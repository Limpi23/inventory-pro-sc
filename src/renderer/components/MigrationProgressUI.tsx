import React from 'react';
import { CheckCircle2, AlertCircle, Loader2, Database } from 'lucide-react';
import { MigrationProgress } from '../lib/migrationService';

interface MigrationProgressUIProps {
  progress: MigrationProgress;
}

const MigrationProgressUI: React.FC<MigrationProgressUIProps> = ({ progress }) => {
  const { currentMigration, percentage, status, error, currentIndex, totalMigrations } = progress;

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
      {/* Header con ícono y título */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          {status === 'running' && (
            <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin absolute -top-1 -right-1" />
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {status === 'running' && 'Configurando Base de Datos'}
            {status === 'success' && 'Configuración Completada'}
            {status === 'error' && 'Error en Configuración'}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {status === 'running' && 'Esto puede tomar unos minutos...'}
            {status === 'success' && '¡Todo listo para comenzar!'}
            {status === 'error' && 'Ocurrió un problema durante la configuración'}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Progreso general
          </span>
          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
            {percentage}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out rounded-full ${
              status === 'success'
                ? 'bg-green-500'
                : status === 'error'
                ? 'bg-red-500'
                : 'bg-blue-600 animate-pulse'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Contador de migraciones */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Migración {currentIndex + 1} de {totalMigrations}
          </span>
          {status === 'running' && (
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ejecutando...
            </span>
          )}
          {status === 'success' && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Completado
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4" />
              Error
            </span>
          )}
        </div>
      </div>

      {/* Migración actual */}
      <div className="mb-6">
        <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
          Migración actual:
        </p>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <code className="text-sm text-blue-900 dark:text-blue-200 font-mono break-all">
            {currentMigration}
          </code>
        </div>
      </div>

      {/* Mensaje de error si existe */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-200 mb-1">
                Error detectado
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de éxito */}
      {status === 'success' && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-900 dark:text-green-200 mb-1">
                Base de datos configurada exitosamente
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Se han ejecutado {totalMigrations} migraciones correctamente.
                Ahora puedes iniciar sesión con las credenciales:
              </p>
              <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-green-300 dark:border-green-700">
                <p className="text-xs font-mono text-gray-800 dark:text-gray-200">
                  <strong>Email:</strong> admin@suitcore.com
                </p>
                <p className="text-xs font-mono text-gray-800 dark:text-gray-200">
                  <strong>Contraseña:</strong> Suitcore123
                </p>
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                ⚠️ Por seguridad, cambia la contraseña después del primer inicio de sesión.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Spinner animado durante ejecución */}
      {status === 'running' && (
        <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 mt-6">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-sm">No cierres esta ventana</span>
        </div>
      )}
    </div>
  );
};

export default MigrationProgressUI;
