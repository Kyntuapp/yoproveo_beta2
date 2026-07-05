import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

export default function MasterHome() {
  const router = useRouter();
  const { authorized, loading } = useRequireMaster();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin-login');
  };

  if (loading || !authorized) {
    return <div style={{ padding: 32 }}>Verificando acceso...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.brandBlock}>
          <img
            src="/yoproveo_logo_mvp.png"
            alt="Kintü"
            style={styles.logo}
          />

          <div>
            <p style={styles.kicker}>Panel interno</p>
            <h1 style={styles.title}>Administrador Kintü</h1>
            <p style={styles.subtitle}>
              Gestión, validación y seguimiento operativo de la plataforma.
            </p>
          </div>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          Cerrar sesión
        </button>
      </div>

      <div style={styles.grid}>
        <button
          style={styles.card}
          onClick={() => router.push('/master/solicitudes')}
        >
          <div style={styles.cardIcon}>📦</div>
          <h3 style={styles.cardTitle}>Solicitudes de productos</h3>
          <p style={styles.cardText}>
            Revisar, aprobar o rechazar productos solicitados por proveedores.
          </p>
        </button>

        <button
          style={styles.card}
          onClick={() => router.push('/master/operaciones')}
        >
          <div style={styles.cardIcon}>📊</div>
          <h3 style={styles.cardTitle}>Listas y ofertas</h3>
          <p style={styles.cardText}>
            Ver todas las listas de compra y ofertas registradas en la plataforma.
          </p>
        </button>

        <button
          style={styles.card}
          onClick={() => router.push('/master/reportes')}
        >
          <div style={styles.cardIcon}>📈</div>
          <h3 style={styles.cardTitle}>Reportes operativos</h3>
          <p style={styles.cardText}>
            KPIs de actividad, liquidez, conversión y ahorro potencial del marketplace.
          </p>
        </button>

        <button
          style={styles.card}
          onClick={() => router.push('/master/war-room')}
        >
          <div style={styles.cardIcon}>🎯</div>
          <h3 style={styles.cardTitle}>War Room</h3>
          <p style={styles.cardText}>
            Validación del piloto y seguimiento de hipótesis.
          </p>
        </button>

        <button style={styles.cardDisabled} disabled>
          <div style={styles.cardIconDisabled}>👥</div>
          <h3 style={styles.cardTitle}>Usuarios</h3>
          <p style={styles.cardText}>
            Gestión de compradores, proveedores y actividad de perfiles.
          </p>
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    padding: 32,
    fontFamily: 'Arial, sans-serif',
    background:
      'linear-gradient(135deg, #F5F8FF 0%, #EEF4FF 45%, #FFFFFF 100%)',
    color: '#071B3A',
  },

  header: {
    backgroundColor: '#071B3A',
    borderRadius: 24,
    padding: 28,
    marginBottom: 28,
    boxShadow: '0 18px 40px rgba(7, 27, 58, 0.18)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    flexWrap: 'wrap',
  },

  brandBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
  },

  logo: {
    width: 96,
    height: 96,
    objectFit: 'contain',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 12,
    boxShadow: '0 10px 24px rgba(0,0,0,0.18)',
  },

  kicker: {
    margin: 0,
    marginBottom: 6,
    color: '#3BE1FF',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  title: {
    margin: 0,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: 800,
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 0,
    color: '#D9E6FF',
    fontSize: 16,
    maxWidth: 620,
    lineHeight: 1.5,
  },

  logoutButton: {
    padding: '10px 18px',
    backgroundColor: '#ef4444',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    fontWeight: 700,
  },

  grid: {
    display: 'flex',
    gap: 22,
    flexWrap: 'wrap',
  },

  card: {
    width: 280,
    minHeight: 175,
    textAlign: 'left',
    padding: 24,
    border: '1px solid #DCE6FF',
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    color: '#071B3A',
    cursor: 'pointer',
    boxShadow: '0 10px 28px rgba(10, 77, 255, 0.10)',
    transition: 'all 0.2s ease',
  },

  cardDisabled: {
    width: 280,
    minHeight: 175,
    textAlign: 'left',
    padding: 24,
    border: '1px solid #E3E8F2',
    borderRadius: 22,
    backgroundColor: '#F7F9FC',
    color: '#7D8798',
    cursor: 'not-allowed',
    opacity: 0.85,
  },

  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EAF1FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    marginBottom: 14,
  },

  cardIconDisabled: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF1F6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    marginBottom: 14,
  },

  cardTitle: {
    margin: 0,
    marginBottom: 10,
    fontSize: 18,
    fontWeight: 800,
  },

  cardText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
  },
};
