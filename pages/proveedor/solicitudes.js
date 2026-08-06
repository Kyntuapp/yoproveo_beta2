import { showKyntuAlert } from '../../lib/kyntuAlert';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';
import AppLayout from '../../components/Layout/AppLayout';
import Notificaciones from '../../components/Notificaciones';

export default function SolicitudesProveedor() {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        showKyntuAlert('Debes iniciar sesión.');
        router.push('/login');
        return;
      }

      const { perfil } = await resolveProveedorProfile(userData.user, {
        select: 'id',
      });

      if (!perfil) {
        showKyntuAlert('No se encontró el perfil de proveedor.');
        router.push('/proveedor');
        return;
      }

      setProveedorId(perfil.id);

      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from('solicitudes_productos')
        .select('*')
        .eq('proveedor_id', perfil.id)

      if (solicitudesError) {
        showKyntuAlert('Error al cargar solicitudes: ' + solicitudesError.message);
      } else {
        setSolicitudes(solicitudesData || []);
      }

      setLoading(false);
    };

    cargarDatos();
  }, [router]);

  const volver = () => router.push('/proveedor/catalogo');
  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  const layoutProps = {
    title: 'Estado de solicitudes',
    profileLabel: 'Proveedor',
    showProfileSwitch: true,
    onChangeProfile: () => router.push('/seleccionar-perfil'),
    onUpdateData: () => router.push('/proveedor/datos-contacto'),
    onDashboard: () => router.push('/proveedor/DashboardProveedor'),
    onLogout: cerrarSesion,
    notifications: proveedorId ? <Notificaciones userId={proveedorId} rol="proveedor" /> : null,
  };

  if (loading) {
    return (
      <AppLayout {...layoutProps}>
        <section style={styles.loadingCard}><span style={styles.spinner} />Cargando solicitudes...</section>
      </AppLayout>
    );
  }

  return (
    <AppLayout {...layoutProps}>
      <section style={styles.card}>
        <div style={styles.headingRow}>
          <div>
            <span style={styles.eyebrow}>Catálogo</span>
            <h1 style={styles.title}>Solicitudes de productos</h1>
            <p style={styles.subtitle}>Revisa el estado y los comentarios de cada producto solicitado.</p>
          </div>
          <button type="button" onClick={volver} style={styles.backButton}>Volver al catálogo</button>
        </div>

      {solicitudes.length === 0 ? (
        <div style={styles.empty}><strong>Aún no tienes solicitudes</strong><span>Los productos que envíes a revisión aparecerán aquí.</span></div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Producto', 'Marca', 'Formato', 'Cantidad referencia', 'Estado', 'Comentario administrador'].map((label) => <th key={label} style={styles.th}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((solicitud) => (
                <tr key={solicitud.identificación || solicitud.id}>
                  <td style={styles.primaryTd}>{solicitud.nombre}</td>
                  <td style={styles.td}>{solicitud.marca || '—'}</td>
                  <td style={styles.td}>{solicitud.formato || '—'}</td>
                  <td style={styles.td}>{solicitud.cantidad_disponible ?? solicitud.cantidad_referencia ?? 0}</td>
                  <td style={styles.td}><span style={{ ...styles.badge, ...estadoStyle(solicitud.estado) }}>{solicitud.estado || 'Pendiente'}</span></td>
                  <td style={styles.td}>{solicitud.comentario_admin || 'Sin comentarios'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </AppLayout>
  );
}

const estadoStyle = (estado) => {
  const value = String(estado || '').toLowerCase();
  if (value.includes('aprobad')) return { color: '#047857', background: '#ecfdf5' };
  if (value.includes('rechaz')) return { color: '#b91c1c', background: '#fef2f2' };
  return { color: '#9a6700', background: '#fffbeb' };
};

const styles = {
  card: { padding: 'clamp(20px, 4vw, 34px)', border: '1px solid #e0e8f4', borderRadius: 24, background: 'rgba(255,255,255,.96)', boxShadow: '0 18px 48px rgba(20,55,120,.1)' },
  headingRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 26 },
  eyebrow: { color: '#176bff', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' },
  title: { margin: '5px 0 6px', color: '#061b41', fontSize: 'clamp(24px, 4vw, 32px)' },
  subtitle: { margin: 0, color: '#60708a', lineHeight: 1.55 },
  backButton: { border: '1px solid #d8e2f0', borderRadius: 13, padding: '11px 16px', color: '#176bff', background: '#f8fbff', fontWeight: 800, cursor: 'pointer' },
  tableWrap: { width: '100%', overflowX: 'auto', border: '1px solid #e5ebf4', borderRadius: 16 },
  table: { width: '100%', minWidth: 900, borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '14px 16px', color: '#50617a', background: '#f5f8fd', borderBottom: '1px solid #e2e9f3', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.04em' },
  td: { padding: '15px 16px', color: '#50617a', borderBottom: '1px solid #edf1f7', fontSize: 14 },
  primaryTd: { padding: '15px 16px', color: '#061b41', borderBottom: '1px solid #edf1f7', fontSize: 14, fontWeight: 800 },
  badge: { display: 'inline-flex', padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 800, textTransform: 'capitalize' },
  empty: { minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', color: '#60708a', background: '#f8fbff', border: '1px dashed #cfdaea', borderRadius: 18 },
  loadingCard: { minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#60708a', background: '#fff', border: '1px solid #e0e8f4', borderRadius: 24 },
  spinner: { width: 24, height: 24, border: '3px solid #dce7f8', borderTopColor: '#176bff', borderRadius: '50%' },
};
