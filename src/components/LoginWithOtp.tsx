import { useState } from 'react';
import { supabase } from '@/integrations/supabase/supabaseClient';

interface LoginWithOtpProps {
  onLoginSuccess?: (session: any) => void;
}

/**
 * Componente para autenticación por OTP (One-Time Password) vía email
 * 
 * Flujo:
 * 1. Usuario ingresa su email
 * 2. Se envía un código OTP al email usando signInWithOtp
 * 3. Usuario ingresa el código recibido
 * 4. Se verifica el código usando verifyOtp con type: 'email'
 * 5. Si es exitoso, se establece la sesión automáticamente
 */
export const LoginWithOtp = ({ onLoginSuccess }: LoginWithOtpProps) => {
  const [email, setEmail] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState<boolean>(false);

  /**
   * Paso 1: Enviar código OTP al email del usuario
   * Usa signInWithOtp con type: 'email' (implícito)
   */
  const handleSendCode = async (): Promise<void> => {
    if (!email) {
      setError('Por favor, ingresa tu email');
      return;
    }

    // Validación básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Por favor, ingresa un email válido');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // URL a la que se redirigirá después de verificar el código (opcional)
          emailRedirectTo: 'http://localhost:8080',
        },
      });

      if (signInError) {
        console.error('Error al enviar código OTP:', signInError);
        setError(signInError.message || 'Error al enviar el código. Intenta de nuevo.');
        return;
      }

      // Éxito: código enviado
      setCodeSent(true);
      setSuccess('Código enviado. Revisa tu correo electrónico.');
      setCode(''); // Limpiar código anterior si existe
    } catch (err) {
      console.error('Error inesperado al enviar código:', err);
      setError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Paso 2: Verificar el código OTP ingresado por el usuario
   * IMPORTANTE: Usa verifyOtp con type: 'email' (no 'magiclink' ni 'signup')
   */
  const handleVerifyCode = async (): Promise<void> => {
    if (!email) {
      setError('Email requerido');
      return;
    }

    if (!code || code.length < 6) {
      setError('Por favor, ingresa el código de 6 dígitos');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Verificar el código OTP usando verifyOtp con type: 'email'
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email', // Tipo correcto para OTP de email
      });

      if (verifyError) {
        console.error('Error al verificar código OTP:', verifyError);
        setError(verifyError.message || 'Código inválido. Intenta de nuevo.');
        return;
      }

      // Éxito: sesión establecida automáticamente por Supabase
      if (data.session) {
        console.log('Sesión iniciada exitosamente:', data.session);
        setSuccess('¡Sesión iniciada correctamente!');
        
        // Limpiar formulario
        setCode('');
        setCodeSent(false);
        
        // Llamar callback opcional
        if (onLoginSuccess) {
          onLoginSuccess(data.session);
        }
      } else {
        setError('No se pudo establecer la sesión. Intenta de nuevo.');
      }
    } catch (err) {
      console.error('Error inesperado al verificar código:', err);
      setError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resetear el formulario para enviar un nuevo código
   */
  const handleReset = (): void => {
    setCodeSent(false);
    setCode('');
    setError(null);
    setSuccess(null);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px' }}>
      <h2>Iniciar sesión con código</h2>

      {/* Campo de email */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="email" style={{ display: 'block', marginBottom: '8px' }}>
          Email:
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          disabled={loading || codeSent}
          style={{
            width: '100%',
            padding: '8px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
      </div>

      {/* Botón para enviar código */}
      {!codeSent && (
        <button
          onClick={handleSendCode}
          disabled={loading || !email}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading || !email ? 'not-allowed' : 'pointer',
            opacity: loading || !email ? 0.6 : 1,
            marginBottom: '16px',
          }}
        >
          {loading ? 'Enviando...' : 'Enviar código'}
        </button>
      )}

      {/* Campo de código OTP (solo visible después de enviar código) */}
      {codeSent && (
        <>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="code" style={{ display: 'block', marginBottom: '8px' }}>
              Código de verificación:
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              disabled={loading}
              maxLength={6}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                textAlign: 'center',
                letterSpacing: '8px',
                fontFamily: 'monospace',
              }}
            />
            <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
              Ingresa el código de 6 dígitos que recibiste por email
            </small>
          </div>

          {/* Botón para verificar código */}
          <button
            onClick={handleVerifyCode}
            disabled={loading || !code || code.length < 6}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading || !code || code.length < 6 ? 'not-allowed' : 'pointer',
              opacity: loading || !code || code.length < 6 ? 0.6 : 1,
              marginBottom: '8px',
            }}
          >
            {loading ? 'Verificando...' : 'Verificar código'}
          </button>

          {/* Botón para reenviar código */}
          <button
            onClick={handleReset}
            disabled={loading}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              backgroundColor: 'transparent',
              color: '#007bff',
              border: '1px solid #007bff',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cambiar email / Reenviar código
          </button>
        </>
      )}

      {/* Mensajes de error */}
      {error && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
          }}
        >
          {error}
        </div>
      )}

      {/* Mensajes de éxito */}
      {success && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#d4edda',
            color: '#155724',
            border: '1px solid #c3e6cb',
            borderRadius: '4px',
          }}
        >
          {success}
        </div>
      )}
    </div>
  );
};

