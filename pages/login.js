import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

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

    // 🔧 NUEVO BLOQUE DE VALIDACIÓN FIJO
    if (error || !data?.user) {
      console.warn('Error de login:', error);
      setErrorMessage('Correo o contraseña incorrectos');
      setShowReset(true); // 👉 forzamos que aparezca el botón
      setLoading(false);
      return;
    }

    const user = data.user;
    localStorage.setItem('user_id', user.id);
    localStorage.setItem('user_email', user.email);

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
    setShowReset(true); // también aquí por seguridad
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

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      console.error(error);
      setErrorMessage('No se pudo enviar el correo de recuperación. Intenta nuevamente.');
    } else {
      setInfoMessage('Te enviamos un correo con el enlace para restablecer tu contraseña.');
      setShowReset(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Iniciar Sesión</h1>

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={styles.input}
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
      />

      {errorMessage && (
        <div>
          <p style={styles.error}>{errorMessage}</p>
          {showReset && (
            <button onClick={handleResetPassword} style={styles.linkButton}>
              Recuperar contraseña
            </button>
          )}
        </div>
      )}

      {infoMessage && <p style={styles.info}>{infoMessage}</p>}

      <div style={styles.buttonGroup}>
        <button onClick={handleLogin} style={styles.button} disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <button onClick={() => router.push('/')} style={styles.secondaryButton}>
          Volver
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    textAlign: 'center',
    paddingTop: '80px',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
  },
  input: {
    display: 'block',
    margin: '10px auto',
    padding: '10px',
    width: '250px',
    borderRadius: '5px',
    border: '1px solid #ccc',
  },
  error: {
    color: 'red',
    fontSize: '14px',
    margin: '10px 0',
  },
  info: {
    color: 'green',
    fontSize: '14px',
    margin: '10px 0',
  },
  buttonGroup: {
    marginTop: '10px',
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
  },
  button: {
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: '#ccc',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#0070f3',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '4px',
  },
};