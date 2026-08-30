import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';
import AppLayout from '../components/Layout/AppLayout';

export default function MisListas() {
  const [listas, setListas] = useState([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const id = localStorage.getItem('user_id');
    if (!id) {
      router.push('/login');
    } else {
      setUsuarioId(id);
      fetchListas(id);
    }
  }, []);

  const fetchListas = async (usuarioId) => {
    const { data, error } = await supabase
      .from('listas_compras')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('fecha_envio', { ascending: false });

    if (error) {
      console.error('Error al obtener listas:', error.message);
    } else {
      setListas(data || []);
    }
    setLoading(false);
  };

  const volver = () => {
    router.push('/comprador');
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  return (
    <AppLayout
      title="Mis listas de compras"
      profileLabel="Comprador"
      showProfileSwitch
      onChangeProfile={() => router.push('/seleccionar-perfil')}
      onUpdateData={() => router.push('/comprador/datos-contacto')}
      onDashboard={() => router.push('/comprador/DashboardComprador')}
      onLogout={cerrarSesion}
    >
      <section style={styles.card}>
        <div style={styles.headingRow}>
          <div><span style={styles.eyebrow}>Compras</span><h1 style={styles.title}>Historial de listas</h1><p style={styles.subtitle}>Consulta los productos incluidos en tus listas de compra.</p></div>
          <button type="button" onClick={volver} style={styles.button}>Volver al panel</button>
        </div>
      {loading ? (
        <div style={styles.empty}>Cargando listas...</div>
      ) : listas.length === 0 ? (
        <div style={styles.empty}><strong>No tienes listas registradas</strong><span>Crea una lista desde el panel comprador para verla aquí.</span></div>
      ) : (
        <div className="mobile-card-table-wrap" style={styles.tableWrap}><table className="mobile-card-table" style={styles.table}>
          <thead>
            <tr>
              {['Fecha', 'Producto', 'Cantidad', 'Marca', 'Formato', 'Precio'].map((label) => <th key={label} style={styles.th}>{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {listas.map((item, idx) => (
              <tr key={idx}>
                <td data-label="Fecha" className="mobile-hide" style={styles.td}>{item.fecha_envio ? new Date(item.fecha_envio).toLocaleString('es-CL') : '—'}</td>
                <td data-label="Producto" data-primary="true" style={styles.primaryTd}>{item.producto || '—'}</td>
                <td data-label="Cantidad" style={styles.td}>{item.cantidad ?? '—'}</td>
                <td data-label="Marca" style={styles.td}>{item.marca || '—'}</td>
                <td data-label="Formato" style={styles.td}>{item.formato || '—'}</td>
                <td data-label="Precio" style={styles.td}>{item.precio != null ? `$${Number(item.precio).toLocaleString('es-CL')}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      </section>
    </AppLayout>
  );
}

const styles = {
  card: { padding: 'clamp(20px, 4vw, 34px)', border: '1px solid #e0e8f4', borderRadius: 24, background: '#fff', boxShadow: '0 18px 48px rgba(20,55,120,.1)' },
  headingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 26 },
  eyebrow: { color: '#176bff', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' },
  title: { margin: '5px 0 6px', color: '#061b41', fontSize: 'clamp(24px, 4vw, 32px)' },
  subtitle: { margin: 0, color: '#60708a' },
  button: { border: 0, borderRadius: 13, padding: '12px 17px', color: '#fff', background: 'linear-gradient(135deg, #176bff, #00afc8)', fontWeight: 800, cursor: 'pointer' },
  tableWrap: { overflowX: 'auto', border: '1px solid #e5ebf4', borderRadius: 16 },
  table: { width: '100%', minWidth: 760, borderCollapse: 'collapse', textAlign: 'left' },
  th: { padding: '14px 16px', color: '#50617a', background: '#f5f8fd', borderBottom: '1px solid #e2e9f3', fontSize: 12, textTransform: 'uppercase' },
  td: { padding: '15px 16px', color: '#50617a', borderBottom: '1px solid #edf1f7', fontSize: 14 },
  primaryTd: { padding: '15px 16px', color: '#061b41', borderBottom: '1px solid #edf1f7', fontWeight: 800 },
  empty: { minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center', color: '#60708a', background: '#f8fbff', border: '1px dashed #cfdaea', borderRadius: 18 },
};
