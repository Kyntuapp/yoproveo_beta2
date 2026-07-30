// pages/proveedor/index.js

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  Boxes,
  PackageSearch,
  Send,
} from 'lucide-react';

import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import Notificaciones from '../../components/Notificaciones';
import AppLayout from '../../components/Layout/AppLayout';

export default function ProveedorIndex() {
  const [perfilId, setPerfilId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: userData, error } =
        await supabase.auth.getUser();

      if (error || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil } = await resolveProveedorProfile(
        userData.user,
        {
          select: 'id, auth_id, email',
        }
      );

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

  const cambiarPerfil = () =>
    router.push('/seleccionar-perfil');

  const irCatalogo = () =>
    router.push('/proveedor/catalogo');

  const irOfertarProductos = () =>
    router.push('/proveedor/ofertar_productos');

  const irOfertasEnviadas = () =>
    router.push('/proveedor/ofertas_enviadas');

  const irDatosContacto = () =>
    router.push('/proveedor/datos-contacto');

  const irDashboard = () =>
    router.push('/proveedor/DashboardProveedor');

  return (
    <AppLayout
      title="Panel del Proveedor"
      profileLabel="Proveedor"
      showProfileSwitch
      onChangeProfile={cambiarPerfil}
      onUpdateData={irDatosContacto}
      onDashboard={irDashboard}
      onLogout={cerrarSesion}
      notifications={
        <Notificaciones
          userId={perfilId}
          rol="proveedor"
        />
      }
    >
      <section
        className="proveedor-card"
        style={styles.card}
      >
        <div
          className="proveedor-heading"
          style={styles.heading}
        >
          <img
            src="/icono_1.png"
            alt="Kyntü"
            style={styles.logo}
          />

          <div style={styles.headingContent}>
            <span style={styles.eyebrow}>
              PANEL DE GESTIÓN
            </span>

            <h2 style={styles.cardTitle}>
              Acciones rápidas
            </h2>

            <p style={styles.cardDescription}>
              Administra tu catálogo, revisa las solicitudes
              de los compradores y consulta las ofertas que
              ya enviaste.
            </p>
          </div>
        </div>

        <div
          className="proveedor-grid"
          style={styles.actionGrid}
        >
          <button
            type="button"
            onClick={irCatalogo}
            className="proveedor-action"
            style={styles.actionCard}
          >
            <span style={styles.iconBox}>
              <Boxes size={25} strokeWidth={2} />
            </span>

            <span style={styles.actionContent}>
              <strong style={styles.actionTitle}>
                Catálogo y stock
              </strong>

              <span style={styles.actionDescription}>
                Agrega productos, modifica sus datos y
                actualiza su disponibilidad.
              </span>
            </span>

            <span style={styles.actionLink}>
              Administrar catálogo
            </span>
          </button>

          <button
            type="button"
            onClick={irOfertarProductos}
            className="proveedor-action"
            style={styles.actionCard}
          >
            <span style={styles.iconBox}>
              <PackageSearch size={25} strokeWidth={2} />
            </span>

            <span style={styles.actionContent}>
              <strong style={styles.actionTitle}>
                Ofertar productos
              </strong>

              <span style={styles.actionDescription}>
                Revisa solicitudes de compra y envía nuevas
                propuestas a los compradores.
              </span>
            </span>

            <span style={styles.actionLink}>
              Ver solicitudes
            </span>
          </button>

          <button
            type="button"
            onClick={irOfertasEnviadas}
            className="proveedor-action"
            style={styles.actionCard}
          >
            <span style={styles.iconBox}>
              <Send size={25} strokeWidth={2} />
            </span>

            <span style={styles.actionContent}>
              <strong style={styles.actionTitle}>
                Mis ofertas enviadas
              </strong>

              <span style={styles.actionDescription}>
                Consulta estados, pagos, conversaciones y
                respuestas de los compradores.
              </span>
            </span>

            <span style={styles.actionLink}>
              Revisar ofertas
            </span>
          </button>
        </div>
      </section>

      <style jsx>{`
        .proveedor-action {
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .proveedor-action:hover {
          transform: translateY(-4px);
          border-color: #b9d1ff !important;
          background: #f8fbff !important;
          box-shadow: 0 20px 42px rgba(31, 69, 122, 0.13);
        }

        .proveedor-action:focus-visible {
          outline: 3px solid rgba(23, 107, 255, 0.22);
          outline-offset: 3px;
        }

        @media (max-width: 950px) {
          .proveedor-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 620px) {
          .proveedor-card {
            padding: 22px 16px !important;
            border-radius: 20px !important;
          }

          .proveedor-heading {
            align-items: flex-start !important;
          }

          .proveedor-heading img {
            width: 64px !important;
            height: 64px !important;
          }
        }

        @media (max-width: 430px) {
          .proveedor-heading {
            flex-direction: column !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .proveedor-action {
            transition: none;
          }
        }
      `}</style>
    </AppLayout>
  );
}

const styles = {
  card: {
    width: '100%',
    padding: '32px',
    boxSizing: 'border-box',
    borderRadius: '26px',
    background: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid #e1e9f4',
    boxShadow: '0 22px 60px rgba(31, 69, 122, 0.10)',
  },

  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    marginBottom: '28px',
  },

  headingContent: {
    minWidth: 0,
  },

  logo: {
    width: '82px',
    height: '82px',
    objectFit: 'contain',
    flexShrink: 0,
  },

  eyebrow: {
    display: 'block',
    marginBottom: '7px',
    color: '#176bff',
    fontSize: '11px',
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: '0.13em',
  },

  cardTitle: {
    margin: 0,
    color: '#061b41',
    fontSize: 'clamp(26px, 3vw, 34px)',
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: '-0.035em',
  },

  cardDescription: {
    maxWidth: '680px',
    margin: '9px 0 0',
    color: '#71829a',
    fontSize: '14px',
    lineHeight: 1.6,
  },

  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '16px',
  },

  actionCard: {
    width: '100%',
    minHeight: '220px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '22px',
    padding: '22px',
    boxSizing: 'border-box',
    borderRadius: '20px',
    border: '1px solid #dfe8f3',
    background: '#ffffff',
    color: '#17365e',
    cursor: 'pointer',
    textAlign: 'left',
  },

  iconBox: {
    width: '52px',
    height: '52px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '15px',
    background:
      'linear-gradient(135deg, #e9f1ff 0%, #e9fbf7 100%)',
    color: '#176bff',
  },

  actionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },

  actionTitle: {
    color: '#17365e',
    fontSize: '17px',
    fontWeight: 900,
  },

  actionDescription: {
    color: '#75869c',
    fontSize: '13px',
    lineHeight: 1.55,
  },

  actionLink: {
    color: '#176bff',
    fontSize: '12px',
    fontWeight: 900,
  },
};