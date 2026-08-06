import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import {
  registrarAceptacionesLegales,
  resolverDestinoPorPerfiles,
  sanitizeInternalNextPath,
  tieneAceptacionesLegalesVigentes,
} from '../utils/aceptacionesLegales';

export default function AceptarDocumentos() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;

    let mounted = true;

    const verificarSesion = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (!session?.user?.id) {
        await router.replace('/login');
        return;
      }

      if (!localStorage.getItem('login_time')) {
        localStorage.setItem('user_id', session.user.id);
        localStorage.setItem('user_email', session.user.email ?? '');
        localStorage.setItem('login_time', Date.now().toString());
        localStorage.setItem('last_activity', Date.now().toString());
      }

      const vigentes = await tieneAceptacionesLegalesVigentes(
        supabase,
        session.user.id
      );

      if (!mounted) return;

      if (vigentes.ok && vigentes.vigentes) {
        const next = sanitizeInternalNextPath(
          router.query.next,
          '/seleccionar-perfil'
        );
        await router.replace(next);
        return;
      }

      setUserId(session.user.id);
      setLoading(false);
    };

    verificarSesion();

    return () => {
      mounted = false;
    };
  }, [router.isReady, router.query.next, router]);

  const resolverDestinoFinal = async () => {
    const next = sanitizeInternalNextPath(
      router.query.next,
      '/seleccionar-perfil'
    );

    if (next !== '/seleccionar-perfil') {
      return next;
    }

    const email = localStorage.getItem('user_email');

    if (!email) {
      return '/seleccionar-perfil';
    }

    const { data: perfiles } = await supabase
      .from('perfiles')
      .select('tipo')
      .eq('email', email.trim().toLowerCase());

    return (
      resolverDestinoPorPerfiles((perfiles || []).map((p) => p.tipo)) ||
      '/seleccionar-perfil'
    );
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!acceptTerms || !acceptPrivacy) {
      setErrorMessage(
        'Debes aceptar los Términos y Condiciones y la Política de Privacidad.'
      );
      return;
    }

    if (!userId) {
      setErrorMessage('No se encontró una sesión válida.');
      return;
    }

    setSubmitting(true);

    try {
      const resultado = await registrarAceptacionesLegales(supabase, userId);

      if (!resultado.ok) {
        setErrorMessage(resultado.message);
        return;
      }

      const destino = await resolverDestinoFinal();
      await router.replace(destino);
    } catch (error) {
      console.error(error);
      setErrorMessage('Ocurrió un error inesperado al registrar las aceptaciones.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loadingText}>Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <img src="/icono_2.png" alt="Kyntü" style={styles.logo} />
        <h1 style={styles.title}>Documentos legales</h1>
        <p style={styles.subtitle}>
          Para continuar usando Kyntü, confirma que has leído y aceptas los
          documentos legales vigentes.
        </p>

        <div style={styles.termsContainer}>
          <label style={styles.termsLabel}>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            <span>
              He leído y acepto los{' '}
              <a
                href="/terminos"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.termsLink}
              >
                Términos y Condiciones
              </a>
              .
            </span>
          </label>

          <label style={styles.termsLabel}>
            <input
              type="checkbox"
              checked={acceptPrivacy}
              onChange={(e) => setAcceptPrivacy(e.target.checked)}
            />
            <span>
              He leído y acepto la{' '}
              <a
                href="/privacidad"
                target="_blank"
                rel="noopener noreferrer"
                style={styles.termsLink}
              >
                Política de Privacidad
              </a>
              .
            </span>
          </label>
        </div>

        {errorMessage && <p style={styles.error}>{errorMessage}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          style={styles.button}
          disabled={submitting}
        >
          {submitting ? 'Guardando...' : 'Aceptar y continuar'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f7f9fc',
    display: 'flex',
    flexDirection: 'column',
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
    width: '270px',
    display: 'block',
    margin: '-49px auto -75px',
  },
  title: {
    fontSize: '30px',
    fontWeight: 900,
    marginBottom: '12px',
    color: '#061b41',
  },
  subtitle: {
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: 1.5,
    marginBottom: '20px',
  },
  termsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    textAlign: 'left',
    marginBottom: '18px',
  },
  termsLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontSize: '14px',
    color: '#4b5563',
    lineHeight: 1.5,
  },
  termsLink: {
    color: '#176BFF',
    fontWeight: 700,
    textDecoration: 'none',
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '14px',
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
    width: '100%',
  },
  loadingText: {
    fontSize: '15px',
    color: '#4b5563',
  },
};
