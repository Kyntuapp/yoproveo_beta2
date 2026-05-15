import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow}></div>
      <div style={styles.backgroundGlow2}></div>

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        style={styles.watermark}
      />

      <div style={styles.card}>
        <img
          src="/yoproveo_logo_mvp.png"
          alt="Kintü"
          style={styles.logo}
        />

        <h1 style={styles.title}>Bienvenido a Kyntü</h1>

        <p style={styles.subtitle}>
          Kyntü es licitar tus compras y elegir al mejor proveedor.
        </p>

        <div style={styles.buttonGroup}>
          <button
            style={styles.primaryButton}
            onClick={() => router.push('/register')}
          >
            Registrarse
          </button>

          <button
            style={styles.secondaryButton}
            onClick={() => router.push('/login')}
          >
            Iniciar Sesión
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background:
      'radial-gradient(circle at top left, #123BFF 0%, #07152E 35%, #020617 100%)',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
  },

  backgroundGlow: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'rgba(0, 140, 255, 0.18)',
    filter: 'blur(100px)',
    top: -150,
    left: -100,
  },

  backgroundGlow2: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '50%',
    background: 'rgba(59, 225, 255, 0.12)',
    filter: 'blur(100px)',
    bottom: -120,
    right: -80,
  },

  watermark: {
    position: 'absolute',
    width: 760,
    opacity: 0.05,
    right: -180,
    bottom: -180,
    filter: 'drop-shadow(0 0 50px rgba(59,225,255,0.25))',
  },

  card: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: 820,
    background: 'rgba(5, 10, 25, 0.82)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 32,
    padding: '42px 50px 54px',
    textAlign: 'center',
    boxShadow: '0 25px 80px rgba(0,0,0,0.45)',
    backdropFilter: 'blur(18px)',
  },

  logo: {
    width: 560,
    maxWidth: '100%',
    marginBottom: 0,
    filter: 'drop-shadow(0 0 18px rgba(59,225,255,0.25))',
  },

  title: {
    fontSize: 42,
    color: '#FFFFFF',
    marginBottom: 16,
    marginTop: -10,
    fontWeight: 800,
    letterSpacing: '-1px',
  },

  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 1.7,
    marginBottom: 42,
    maxWidth: 560,
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: 0,
  },

  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: 18,
    flexWrap: 'wrap',
  },

  primaryButton: {
    padding: '15px 34px',
    fontSize: 16,
    fontWeight: 700,
    background:
      'linear-gradient(135deg, #0A4DFF 0%, #2563FF 100%)',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 14,
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(10,77,255,0.35)',
    transition: '0.2s',
  },

  secondaryButton: {
    padding: '15px 34px',
    fontSize: 16,
    fontWeight: 700,
    background: 'rgba(255,255,255,0.06)',
    color: '#FFFFFF',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 14,
    cursor: 'pointer',
    backdropFilter: 'blur(6px)',
    transition: '0.2s',
  },
};