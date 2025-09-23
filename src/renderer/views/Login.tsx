import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { signIn } = useAuth();
  const [lastError, setLastError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Cargar credenciales guardadas al iniciar
  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    const savedPassword = localStorage.getItem('remembered_password');
    
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validación básica
    if (!email || !password) {
      toast.error('Por favor, ingresa email y contraseña');
      return;
    }
    
    try {
      setLoading(true);
      
      // Guardar credenciales si "Recuérdame" está activado
      if (rememberMe) {
        localStorage.setItem('remembered_email', email);
        localStorage.setItem('remembered_password', password);
      } else {
        // Eliminar credenciales guardadas si está desactivado
        localStorage.removeItem('remembered_email');
        localStorage.removeItem('remembered_password');
      }
      
      // Usar el método signIn del contexto de autenticación
  const success = await signIn(email, password);
      
      if (success) {
        navigate('/');
      } else {
        setLastError('AuthApiError: Email not confirmed');
      }
    } catch (error) {
      console.error('Error en inicio de sesión:', error);
      const msg = (error as any)?.message || '';
      setLastError(msg);
      if (/email not confirmed/i.test(msg)) {
        toast.error('Debes confirmar tu email. Puedes reenviar el correo de confirmación.');
      } else {
        toast.error('Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-10 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary">Inventario Pro - SC</h1>
          <h2 className="mt-6 text-xl font-semibold text-gray-900">
            Iniciar Sesión
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa tus credenciales para acceder al sistema
          </p>
          {/* Aviso si no hay configuración Supabase */}
          {typeof (window as any).supabaseConfig !== 'undefined' && (
            <ConfigNotice />
          )}
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                placeholder="correo@ejemplo.com"
              />
            </div>
            
            <div>
              <Label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                Contraseña
              </Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="rememberMe" 
                checked={rememberMe} 
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <Label 
                htmlFor="rememberMe" 
                className="text-sm font-medium text-gray-700 cursor-pointer"
              >
                Recuérdame
              </Label>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </div>
        </form>
        <div className="text-center mt-2">
          <button
            type="button"
            onClick={() => navigate('/reset-password')}
            className="text-sm text-blue-600 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        {lastError && /email not confirmed/i.test(lastError) && (
          <div className="text-center mt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  const svc = (await import('../lib/authService')).default;
                  await svc.resendSignupConfirmation(email);
                  toast.success('Correo de confirmación reenviado');
                } catch (e: any) {
                  toast.error(e?.message || 'No se pudo reenviar el correo');
                }
              }}
              className="text-sm text-blue-600 hover:underline"
              disabled={!email}
            >
              Reenviar correo de confirmación
            </button>
          </div>
        )}
        
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">
            ©2025 Inventario Pro - SC - Todos los derechos reservados
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 

// Componente interno para mostrar aviso y botón de configuración
const ConfigNotice: React.FC = () => {
  const [checking, setChecking] = React.useState(true);
  const [needsConfig, setNeedsConfig] = React.useState(false);
  React.useEffect(() => {
    const api: any = (window as any).supabaseConfig;
    if (!api || typeof api.get !== 'function') {
      setNeedsConfig(true);
      setChecking(false);
      return;
    }
    api.get().then((cfg: any) => {
      if (!cfg || !cfg.url || !cfg.anonKey) setNeedsConfig(true);
    }).finally(() => setChecking(false));
  }, []);
  if (checking || !needsConfig) return null;
  return (
    <div className="mt-4 text-left p-3 rounded-md bg-amber-100 text-amber-900 text-xs border border-amber-300">
      Falta configurar la conexión a Supabase.
      <button
        onClick={() => { sessionStorage.setItem('forceOnboarding','1'); location.reload(); }}
        className="ml-2 underline font-semibold"
      >Configurar ahora</button>
    </div>
  );
};