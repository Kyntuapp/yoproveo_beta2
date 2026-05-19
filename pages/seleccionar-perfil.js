import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function SeleccionarPerfil() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState([]);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const emailGuardado = localStorage.getItem('user_email');

    if (!emailGuardado) {
      setErrorMessage('No se encontró información del usuario.');
      return;
    }

    setEmail(emailGuardado);

    const obtenerPerfiles = async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('tipo')
        .eq('email', emailGuardado);

      if (error || !data) {
        setErrorMessage('Error al obtener perfiles');
        return;
      }

      setPerfiles(data.map((perfil) => perfil.tipo));
    };

    obtenerPerfiles();
  }, []);

  const irAPerfil = (tipo) => {
    router.push(`/${tipo}`);
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

        <h1 style={styles.title}>Selecciona tu perfil</h1>

        {email && (
          <p style={styles.subtitle}>
            Estás ingresando como <strong>{email}</strong>
          </p>
        )}

        {errorMessage && <p style={styles.error}>{errorMessage}</p>}

        <div style={styles.buttonGroup}>
          {perfiles.includes('comprador') && (
            <button
              onClick={() => irAPerfil('comprador')}
              style={styles.button}
            >
              Ir a Comprador
            </button>
          )}

          {perfiles.includes('proveedor') && (
            <button
              onClick={() => irAPerfil('proveedor')}
              style={styles.button}
            >
              Ir a Proveedor
            </button>
          )}
        </div>

        <button
          onClick={() => router.push('/')}
          style={styles.secondaryButton}
        >
          Volver al inicio
        </button>
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
    margin: '0 0 14px',
    fontWeight: 800,
    textShadow: '0 3px 12px rgba(0,0,0,0.35)',
  },

  subtitle: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: '14px',
    margin: '0 0 28px',
  },

  error: {
    color: '#ff7b7b',
    fontSize: '14px',
    margin: '0 0 20px',
    textAlign: 'center',
  },

  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '14px',
    marginBottom: '18px',
    flexWrap: 'wrap',
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
};