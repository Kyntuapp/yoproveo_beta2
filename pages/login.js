import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    setInfoMessage('');
    setShowReset(false);
    setLoading(true);

    try {
      if (!email || !password) {
        setErrorMessage('Por favor ingresa correo y contraseña.');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data?.user) {
        console.warn('Error de login:', error);
        setErrorMessage('Correo o contraseña incorrectos');
        setShowReset(true);
        setLoading(false);
        return;
      }

      const user = data.user;

      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_email', user.email);
      localStorage.setItem('login_time', Date.now().toString());
      localStorage.setItem('last_activity', Date.now().toString());

      const { data: perfiles, error: perfilesError } = await supabase
        .from('perfiles')
        .select('tipo')
        .eq('email', normalizedEmail);

      if (perfilesError) {
        setErrorMessage('Error al obtener perfiles.');
        setLoading(false);
        return;
      }

      const tiposUnicos = [...new Set(perfiles.map((p) => p.tipo))];

      if (tiposUnicos.length === 1) {
        router.push(`/${tiposUnicos[0]}`);
      } else if (tiposUnicos.length > 1) {
        router.push('/seleccionar-perfil');
      } else {
        setErrorMessage('No tienes perfiles asignados.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Ocurrió un error inesperado.');
      setShowReset(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setErrorMessage('Ingresa tu correo para recuperar la contraseña.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      console.error(error);
      setErrorMessage(
        'No se pudo enviar el correo de recuperación. Intenta nuevamente.'
      );
    } else {
      setInfoMessage(
        'Te enviamos un correo con el enlace para restablecer tu contraseña.'
      );
      setShowReset(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow}></div>

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        style={styles.watermark}
      />

      <div style={styles.card}>
        <img
          src="/icono_1.png"
          alt="Kyntü"
          style={styles.logo}
        />

        <h1 style={styles.title}>Iniciar Sesión</h1>

        <input
          type="email"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <div style={styles.passwordWrapper}>
  <input
    type={showPassword ? 'text' : 'password'}
    placeholder="Contraseña"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    style={styles.passwordInput}
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    style={styles.eyeButton}
  >
    {showPassword ? (
      <EyeOff size={18} />
    ) : (
      <Eye size={18} />
    )}
  </button>
</div>

        {errorMessage && (
          <div>
            <p style={styles.error}>{errorMessage}</p>

            {showReset && (
              <button
                onClick={handleResetPassword}
                style={styles.linkButton}
              >
                Recuperar contraseña
              </button>
            )}
          </div>
        )}

        {infoMessage && (
          <p style={styles.info}>{infoMessage}</p>
        )}

        <div style={styles.buttonGroup}>
          <button
            onClick={handleLogin}
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <button
            onClick={() => router.push('/')}
            style={styles.secondaryButton}
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    width: '100%',
    background:
      'linear-gradient(135deg, #1f5cff 0%, #071426 42%, #050b18 100%)',
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
      'radial-gradient(circle at 18% 18%, rgba(31, 92, 255, 0.38), transparent 32%), radial-gradient(circle at 80% 75%, rgba(0, 255, 195, 0.10), transparent 28%)',
    zIndex: 1,
  },

  watermark: {
    position: 'absolute',
    top: '35px',
    left: '45px',
    width: '260px',
    opacity: 0.08,
    zIndex: 2,
    filter: 'drop-shadow(0 0 18px rgba(0,255,210,0.55))',
    pointerEvents: 'none',
  },

  card: {
    width: 'min(760px, 90%)',
    minHeight: '500px',
    background: 'rgba(5, 12, 29, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.35)',
    zIndex: 3,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '38px 32px',
    backdropFilter: 'blur(10px)',
  },

  logo: {
    width: '500px',
    marginBottom: '-70px',
    filter: 'drop-shadow(0 0 28px rgba(0,255,210,0.45))',
  },

  title: {
    fontSize: '38px',
    color: '#ffffff',
    margin: '0 0 26px',
    fontWeight: 800,
    textShadow: '0 3px 12px rgba(0,0,0,0.35)',
  },

 input: {
  display: 'block',
  width: '280px',
  padding: '13px 15px',
  margin: '8px auto',
  borderRadius: '10px',
  border: '1px solid #d1d5db',
  background: '#ffffff',
  color: '#111827',
  outline: 'none',
  fontSize: '14px',
  boxSizing: 'border-box',
},

  error: {
    color: '#ff7b7b',
    fontSize: '14px',
    margin: '12px 0 4px',
    textAlign: 'center',
  },

  info: {
    color: '#31f7c6',
    fontSize: '14px',
    margin: '12px 0 4px',
    textAlign: 'center',
  },

  buttonGroup: {
    marginTop: '22px',
    display: 'flex',
    justifyContent: 'center',
    gap: '14px',
  },

  button: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#fff',
    border: 'none',
    padding: '13px 32px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.32)',
  },

  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '13px 32px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },

  linkButton: {
    background: 'none',
    border: 'none',
    color: '#31f7c6',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '4px',
  },

  passwordWrapper: {
  position: 'relative',
  width: '280px',
  margin: '8px auto',
},

passwordInput: {
  width: '100%',
  padding: '13px 45px 13px 15px',
  borderRadius: '10px',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#ffffff',
  outline: 'none',
  fontSize: '14px',
  boxSizing: 'border-box',
},

eyeButton: {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent',
  border: 'none',
  color: '#9ca3af',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
},
};