import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { buildAceptarDocumentosPath } from '../../utils/aceptacionesLegales';

export default function AuthConfirm() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const finalizarConfirmacion = async (session) => {
      if (!mounted || !session?.user) return;

      localStorage.setItem('user_id', session.user.id);
      localStorage.setItem('user_email', session.user.email ?? '');
      localStorage.setItem('login_time', Date.now().toString());
      localStorage.setItem('last_activity', Date.now().toString());

      await router.replace(
        buildAceptarDocumentosPath('/seleccionar-perfil')
      );
    };

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session?.user) {
        await finalizarConfirmacion(session);
        return;
      }

      setChecking(false);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        session?.user
      ) {
        setChecking(true);
        await finalizarConfirmacion(session);
      }
    });

    const timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      setChecking(false);
      setErrorMessage(
        'No pudimos confirmar tu correo. El enlace puede haber expirado.'
      );
    }, 12000);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/icono_2.png" alt="Kyntü" style={styles.logo} />
        <h1 style={styles.title}>Confirmación de correo</h1>

        {checking ? (
          <p style={styles.message}>Verificando tu cuenta...</p>
        ) : (
          <>
            <p style={styles.error}>{errorMessage}</p>
            <button
              type="button"
              style={styles.button}
              onClick={() => router.push('/login')}
            >
              Ir a iniciar sesión
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f7f9fc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
    color: '#061b41',
  },
  card: {
    width: '100%',
    maxWidth: '430px',
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '28px',
    padding: '38px 34px',
    boxShadow: '0 30px 90px rgba(20, 55, 120, 0.12)',
    textAlign: 'center',
  },
  logo: {
    width: '220px',
    display: 'block',
    margin: '0 auto 12px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 900,
    marginBottom: '16px',
    color: '#061b41',
  },
  message: {
    fontSize: '15px',
    color: '#4b5563',
    lineHeight: 1.5,
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '18px',
    lineHeight: 1.5,
  },
  button: {
    background: '#176BFF',
    color: '#fff',
    border: 'none',
    padding: '13px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 900,
    boxShadow: '0 14px 28px rgba(23,107,255,0.24)',
  },
};
