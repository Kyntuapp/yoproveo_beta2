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
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    setInfoMessage('');
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
          src="/icono_2.png"
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
            <p style={styles.error}>{errorMessage}</p>
          )}

          <button
            type="button"
            onClick={handleResetPassword}
            style={styles.linkButton}
          >
            ¿Olvidaste tu contraseña?
          </button>

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
    zIndex: 1,
  },

  watermark: {
    position: 'absolute',
    top: '34px',
    left: '42px',
    width: '220px',
    opacity: 0.13,
    pointerEvents: 'none',
    zIndex: 2,
  },

  card: {
    position: 'relative',
    zIndex: 3,
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

  logo: {
    width: '150px',
    height: '150px',
    objectFit: 'contain',
    marginBottom: '22px',
    filter: 'drop-shadow(0 12px 24px rgba(30, 91, 255, 0.18))',
  },

  title: {
    margin: '0 0 26px',
    color: '#071b3d',
    fontSize: '34px',
    lineHeight: 1.15,
    fontWeight: 800,
    textAlign: 'center',
  },

  input: {
    display: 'block',
    width: '100%',
    maxWidth: '340px',
    height: '50px',
    padding: '0 16px',
    margin: '0 auto 14px',
    boxSizing: 'border-box',
    border: '1px solid #d6deeb',
    borderRadius: '12px',
    background: '#f8faff',
    color: '#071b3d',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: '14px',
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

  error: {
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

  info: {
    width: '100%',
    maxWidth: '340px',
    margin: '12px auto 0',
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

  linkButton: {
    marginTop: '4px',
    padding: '4px 8px',
    background: 'transparent',
    border: 'none',
    color: '#1e5bff',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '14px',
    fontWeight: 600,
  },

  buttonGroup: {
    width: '100%',
    maxWidth: '340px',
    marginTop: '22px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },

  button: {
    width: '100%',
    minHeight: '50px',
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
  },

  secondaryButton: {
    width: '100%',
    minHeight: '50px',
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
  },
};