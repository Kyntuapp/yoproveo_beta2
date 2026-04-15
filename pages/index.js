import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => router.push('/admin-login')} style={styles.adminButton}>
          Administrador
        </button>
      </div>

      <img src="/yoproveo_logo_mvp.png" alt="Logo" style={styles.logo} />

      <h1 style={styles.title}>Bienvenido a YoProveo</h1>
      <p style={styles.subtitle}>Una plataforma pensada para proveedores y comercios locales.</p>

      <div style={styles.buttonGroup}>
        <button style={styles.button} onClick={() => router.push('/register')}>
          Registrarse
        </button>
        <button style={styles.button} onClick={() => router.push('/login')}>
          Iniciar Sesión
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    textAlign: 'center',
    paddingTop: '60px',
    fontFamily: 'Arial, sans-serif',
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  adminButton: {
    backgroundColor: '#888',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  logo: {
    height: '140px',
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    marginBottom: '10px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '15px',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};
