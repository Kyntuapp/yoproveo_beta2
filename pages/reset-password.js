import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const router = useRouter();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setRecoveryReady(Boolean(session));
      setCheckingSession(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'PASSWORD_RECOVERY' && session) {
        setRecoveryReady(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (event) => {
    event.preventDefault();

    setErrorMessage('');
    setInfoMessage('');

    if (!password || !confirmPassword) {
      setErrorMessage('Completa ambos campos.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage(
        'La contraseña debe tener al menos 6 caracteres.'
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        console.error('Error actualizando contraseña:', error);
        setErrorMessage(
          `No se pudo actualizar la contraseña: ${error.message}`
        );
        return;
      }

      setInfoMessage(
        'Contraseña actualizada correctamente. Serás redirigido al inicio de sesión.'
      );

      await supabase.auth.signOut();

      setTimeout(() => {
        router.push('/login');
      }, 1800);
    } catch (error) {
      console.error('Error inesperado:', error);
      setErrorMessage(
        'Ocurrió un error al actualizar la contraseña.'
      );
    } finally {
      setLoading(false);
    }
  };

  const content = checkingSession ? (
    <div style={styles.messageContent}>
      <p style={styles.loadingText}>
        Verificando enlace de recuperación...
      </p>
    </div>
  ) : !recoveryReady ? (
    <div style={styles.messageContent}>
      <img
        src="/icono_2.png"
        alt="Kyntü"
        style={styles.logo}
      />

      <h1 style={styles.title}>Enlace no válido</h1>

      <p style={styles.description}>
        El enlace venció, ya fue utilizado o no se abrió correctamente.
      </p>

      <button
        type="button"
        onClick={() => router.push('/login')}
        style={styles.button}
      >
        Volver al inicio de sesión
      </button>
    </div>
  ) : (
    <form onSubmit={handleUpdatePassword} style={styles.formContent}>
      <img
        src="/icono_2.png"
        alt="Kyntü"
        style={styles.logo}
      />

      <h1 style={styles.title}>Restablecer contraseña</h1>

      <p style={styles.description}>
        Ingresa y confirma tu nueva contraseña.
      </p>

      <div style={styles.passwordWrapper}>
        <input
          type={showPassword ? 'text' : 'password'}
          placeholder="Nueva contraseña"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          style={styles.passwordInput}
        />

        <button
          type="button"
          onClick={() =>
            setShowPassword((current) => !current)
          }
          style={styles.eyeButton}
          aria-label={
            showPassword
              ? 'Ocultar contraseña'
              : 'Mostrar contraseña'
          }
        >
          {showPassword ? (
            <EyeOff size={19} />
          ) : (
            <Eye size={19} />
          )}
        </button>
      </div>

      <div style={styles.passwordWrapper}>
        <input
          type={showConfirmPassword ? 'text' : 'password'}
          placeholder="Confirmar nueva contraseña"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          autoComplete="new-password"
          style={styles.passwordInput}
        />

        <button
          type="button"
          onClick={() =>
            setShowConfirmPassword((current) => !current)
          }
          style={styles.eyeButton}
          aria-label={
            showConfirmPassword
              ? 'Ocultar contraseña'
              : 'Mostrar contraseña'
          }
        >
          {showConfirmPassword ? (
            <EyeOff size={19} />
          ) : (
            <Eye size={19} />
          )}
        </button>
      </div>

      {errorMessage && (
        <div style={styles.errorBox}>{errorMessage}</div>
      )}

      {infoMessage && (
        <div style={styles.infoBox}>{infoMessage}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          ...styles.button,
          opacity: loading ? 0.65 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? 'Guardando...'
          : 'Guardar nueva contraseña'}
      </button>

      <button
        type="button"
        onClick={() => router.push('/login')}
        style={styles.secondaryButton}
      >
        Volver
      </button>
    </form>
  );

  return (
    <main style={styles.page}>
      <div style={styles.backgroundGlow} />

      <img
        src="/Marca de agua.png"
        alt=""
        aria-hidden="true"
        style={styles.watermark}
      />

      <section style={styles.card}>{content}</section>
    </main>
  );
}



const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    padding: '28px',
    boxSizing: 'border-box',
    background:
      'linear-gradient(135deg, #f7f9ff 0%, #eef4ff 48%, #f8fbff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },

  backgroundGlow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 12% 20%, rgba(36, 94, 255, 0.16), transparent 32%), radial-gradient(circle at 88% 78%, rgba(12, 193, 201, 0.14), transparent 28%)',
    pointerEvents: 'none',
  },

  watermark: {
    position: 'absolute',
    top: '34px',
    left: '42px',
    width: '220px',
    opacity: 0.13,
    pointerEvents: 'none',
  },

  card: {
    position: 'relative',
    zIndex: 2,
    width: 'min(500px, 100%)',
    minHeight: '520px',
    padding: '42px 38px',
    boxSizing: 'border-box',
    background: '#ffffff',
    border: '1px solid #e2e8f2',
    borderRadius: '26px',
    boxShadow: '0 24px 70px rgba(15, 42, 86, 0.14)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  formContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  messageContent: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },

  logo: {
    width: '150px',
    height: '150px',
    objectFit: 'contain',
    marginBottom: '22px',
    filter: 'drop-shadow(0 12px 24px rgba(30, 91, 255, 0.18))',
  },

  title: {
    margin: '0 0 14px',
    color: '#071b3d',
    fontSize: '34px',
    lineHeight: 1.15,
    fontWeight: 800,
    textAlign: 'center',
  },

  description: {
    width: '100%',
    maxWidth: '360px',
    margin: '0 auto 28px',
    color: '#66758f',
    fontSize: '15px',
    lineHeight: 1.5,
    textAlign: 'center',
  },

  loadingText: {
    margin: 0,
    color: '#071b3d',
    fontSize: '15px',
    textAlign: 'center',
  },

  passwordWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '340px',
    margin: '0 auto 14px',
  },

  passwordInput: {
    display: 'block',
    width: '100%',
    height: '50px',
    padding: '0 48px 0 16px',
    boxSizing: 'border-box',
    border: '1px solid #d6deeb',
    borderRadius: '12px',
    background: '#f8faff',
    color: '#071b3d',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: '14px',
  },

  eyeButton: {
    position: 'absolute',
    top: '50%',
    right: '15px',
    transform: 'translateY(-50%)',
    padding: '4px',
    background: 'transparent',
    border: 'none',
    color: '#71809a',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorBox: {
    width: '100%',
    maxWidth: '340px',
    margin: '4px auto 0',
    padding: '11px 13px',
    boxSizing: 'border-box',
    background: '#fff1f0',
    border: '1px solid #ffd2cf',
    borderRadius: '10px',
    color: '#b42318',
    fontSize: '13px',
    lineHeight: 1.45,
    textAlign: 'center',
  },

  infoBox: {
    width: '100%',
    maxWidth: '340px',
    margin: '4px auto 0',
    padding: '11px 13px',
    boxSizing: 'border-box',
    background: '#ecfdf8',
    border: '1px solid #b8efe3',
    borderRadius: '10px',
    color: '#087f72',
    fontSize: '13px',
    lineHeight: 1.45,
    textAlign: 'center',
  },

  button: {
    width: '100%',
    maxWidth: '340px',
    minHeight: '50px',
    margin: '22px auto 0',
    padding: '13px 22px',
    boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #1e5bff 0%, #1677ff 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 800,
    boxShadow: '0 11px 25px rgba(30, 91, 255, 0.24)',
    display: 'block',
  },

  secondaryButton: {
    width: '100%',
    maxWidth: '340px',
    minHeight: '50px',
    margin: '12px auto 0',
    padding: '13px 22px',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#071b3d',
    border: '1px solid #d6deeb',
    borderRadius: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 800,
    display: 'block',
  },
};