// pages/proveedor/index.js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import Notificaciones from '../../components/Notificaciones';

export default function ProveedorIndex() {
  const [perfilId, setPerfilId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: userData, error } = await supabase.auth.getUser();

      if (error || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil } = await resolveProveedorProfile(userData.user, {
        select: 'id, auth_id, email',
      });

      if (!perfil) {
        alert('No se encontró perfil de proveedor');
        router.push('/');
        return;
      }

      setPerfilId(perfil.id);
    };

    checkUser();
  }, [router]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  const cambiarPerfil = () => router.push('/seleccionar-perfil');
  const irCatalogo = () => router.push('/proveedor/catalogo');
  const irOfertarProductos = () => router.push('/proveedor/ofertar_productos');
  const irOfertasEnviadas = () => router.push('/proveedor/ofertas_enviadas');
  const irDatosContacto = () => router.push('/proveedor/datos-contacto');

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow}></div>

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        style={styles.watermark}
      />

      {/* Barra superior */}
      <div style={styles.topBar}>
        <div style={styles.leftActions}>
          <button onClick={cambiarPerfil} style={styles.secondaryButton}>
            Cambiar perfil
          </button>

          <button onClick={irDatosContacto} style={styles.secondaryButton}>
            Actualizar datos
          </button>
        </div>

        <div style={styles.centerTitle}>
          <h1 style={styles.title}>Panel del Proveedor</h1>
        </div>

        <div style={styles.rightActions}>
          <Notificaciones userId={perfilId} rol="proveedor" />

          <button onClick={cerrarSesion} style={styles.logoutButton}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={styles.content}>
        <div style={styles.card}>
          <img
            src="/icono_1.png"
            alt="Kyntü"
            style={styles.logo}
          />

          <h2 style={styles.cardTitle}>Acciones rápidas</h2>

          <div style={styles.buttonGroup}>
            <button onClick={irCatalogo} style={styles.mainButton}>
              Catálogo y Stock
            </button>

            <button onClick={irOfertarProductos} style={styles.mainButton}>
              Ofertar Productos
            </button>

            <button onClick={irOfertasEnviadas} style={styles.mainButton}>
              Mis Ofertas Enviadas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg, #1f5cff 0%, #071426 42%, #050b18 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px',
    boxSizing: 'border-box',
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
    zIndex: 1,
    filter: 'drop-shadow(0 0 18px rgba(0,255,210,0.55))',
    pointerEvents: 'none',
  },

  topBar: {
    position: 'relative',
    zIndex: 3,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    marginBottom: '40px',
  },

  leftActions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },

  centerTitle: {
    display: 'flex',
    justifyContent: 'center',
  },

  rightActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  title: {
    color: '#ffffff',
    fontSize: '38px',
    fontWeight: 800,
    margin: 0,
    textAlign: 'center',
    textShadow: '0 3px 12px rgba(0,0,0,0.35)',
  },

  content: {
    position: 'relative',
    zIndex: 3,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: '30px',
  },

  card: {
    width: '420px',
    background: 'rgba(5, 12, 29, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.35)',
    padding: '40px 32px',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },

  logo: {
    width: '220px',
    marginBottom: '-20px',
    filter: 'drop-shadow(0 0 28px rgba(0,255,210,0.45))',
  },

  cardTitle: {
    color: '#ffffff',
    fontSize: '28px',
    marginBottom: '28px',
    fontWeight: 800,
  },

  buttonGroup: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },

  mainButton: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#fff',
    border: 'none',
    padding: '15px 20px',
    borderRadius: '14px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '15px',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.32)',
  },

  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '10px 18px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  },

  logoutButton: {
    background: 'rgba(255, 80, 80, 0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255, 80, 80, 0.25)',
    padding: '10px 18px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  },
};