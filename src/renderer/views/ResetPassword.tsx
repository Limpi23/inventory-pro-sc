import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'react-hot-toast';

// Vista que maneja dos casos:
// 1) Solicitar email de recuperación (si no hay access_token en URL)
// 2) Establecer nueva contraseña (si Supabase redirige con access_token + type=recovery)
const ResetPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'request' | 'reset'>(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', '?'));
    const type = params.get('type');
    return type === 'recovery' ? 'reset' : 'request';
  });

  const handleRequest = async () => {
    if (!email) { toast.error('Ingrese su email'); return; }
    setLoading(true);
    try {
      const client = await supabase.getClient();
      const redirectTo = window.location.origin + '/reset-password';
      const { error } = await (client as any).auth.resetPasswordForEmail(email.toLowerCase(), { redirectTo });
      if (error) throw error;
      toast.success('Hemos enviado un email con instrucciones');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo enviar el correo');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!password) { toast.error('Ingrese su nueva contraseña'); return; }
    setLoading(true);
    try {
      const client = await supabase.getClient();
      const { error } = await (client as any).auth.updateUser({ password });
      if (error) throw error;
      toast.success('Contraseña actualizada. Ya puede iniciar sesión.');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo actualizar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-md shadow p-6">
        {stage === 'request' ? (
          <>
            <h1 className="text-xl font-semibold mb-4">Recuperar contraseña</h1>
            <p className="text-sm text-muted-foreground mb-4">Ingrese su email y le enviaremos un enlace para restablecer su contraseña.</p>
            <div className="space-y-3">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="mt-4 w-full" onClick={handleRequest} disabled={loading}>
              Enviar enlace
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold mb-4">Establecer nueva contraseña</h1>
            <p className="text-sm text-muted-foreground mb-4">Ingrese su nueva contraseña y guárdela.</p>
            <div className="space-y-3">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button className="mt-4 w-full" onClick={handleReset} disabled={loading}>
              Guardar contraseña
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
