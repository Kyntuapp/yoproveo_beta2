import { showKyntuAlert } from '../../lib/kyntuAlert';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';
import KyntuStatusPage from '../../components/KyntuStatusPage';

const getListaId = (lista) =>
  lista?.id ?? lista?.identificacion ?? lista?.['identificación'] ?? null;

const estadoTexto = (estado) => {
  switch ((estado || '').toLowerCase()) {
    case 'pendiente':
      return 'Oferta enviada';
    case 'en_espera_confirmacion':
      return 'Aceptada';
    case 'pendiente_pago':
      return 'Pendiente de pago';
    case 'confirmada':
      return 'Confirmada';
    case 'rechazada':
      return 'Rechazada';
    default:
      return estado || '—';
  }
};

export default function MasterOperaciones() {
  const router = useRouter();
  const { authorized, loading } = useRequireMaster();

  const [listas, setListas] = useState([]);
  const [ofertas, setOfertas] = useState([]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    if (!authorized) return;

    const fetchData = async () => {
      const { data: listasCompra, error: listasError } = await supabase
        .from('listas_compras')
        .select(
          'id, usuario_id, comprador_email, fecha_creacion, comuna_despacho, producto, formato, marca, cantidad, precio'
        )
        .order('fecha_creacion', { ascending: false });

      if (listasError) {
        showKyntuAlert('Error al cargar listas de compra: ' + listasError.message);
        return;
      }

      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select(
          'id, lista_id, proveedor_id, producto, formato, marca, precio_ofertado, incluye_despacho, estado'
        )
        .order('id', { ascending: false });

      if (ofertasError) {
        showKyntuAlert('Error al cargar ofertas: ' + ofertasError.message);
        return;
      }

      const { data: perfilesData, error: perfilesError } = await supabase
        .from('perfiles')
        .select('id, auth_id, tipo, email, email_contacto')
        .in('tipo', ['comprador', 'proveedor']);

      if (perfilesError) {
        showKyntuAlert('Error al cargar perfiles: ' + perfilesError.message);
        return;
      }

      const proveedorPorId = {};
      const compradorPorAuthId = {};

      (perfilesData || []).forEach((perfil) => {
        const email = (perfil.email_contacto || perfil.email || '').trim();

        if (perfil.tipo === 'proveedor') {
          proveedorPorId[perfil.id] = email || 'Desconocido';
        }

        if (perfil.tipo === 'comprador' && perfil.auth_id) {
          compradorPorAuthId[perfil.auth_id] = email || 'Desconocido';
        }
      });

      const listasEnriquecidas = (listasCompra || []).map((lista) => ({
        ...lista,
        compradorDisplay:
          (lista.comprador_email || '').trim() ||
          compradorPorAuthId[lista.usuario_id] ||
          'Desconocido',
      }));

      const ofertasEnriquecidas = (ofertasData || []).map((oferta) => ({
        ...oferta,
        proveedorDisplay:
          proveedorPorId[oferta.proveedor_id] || 'Desconocido',
      }));

      setListas(listasEnriquecidas);
      setOfertas(ofertasEnriquecidas);
    };

    fetchData();
  }, [authorized]);

  if (loading || !authorized) {
    return <KyntuStatusPage title="Verificando acceso" message="Validando tus permisos de administración." />;
  }

  return (
    <main style={styles.page}>
      <div style={styles.glow} />
      <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <span style={styles.eyebrow}>Panel master</span>
          <h1 style={styles.title}>Listas y ofertas</h1>
          <p style={styles.subtitle}>Visión consolidada de la operación comercial de Kyntü.</p>
        </div>
        <div style={styles.actions}>
          <button onClick={() => router.push('/master')} style={styles.backButton}>Volver al panel</button>
          <button onClick={handleLogout} style={styles.logoutButton}>Cerrar sesión</button>
        </div>
      </header>

      <section style={styles.section}>
        <div style={styles.sectionHeading}><div><span style={styles.count}>{listas.length}</span><h2 style={styles.sectionTitle}>Listas de compra</h2></div><p style={styles.sectionText}>Solicitudes creadas por compradores.</p></div>
        {listas.length === 0 ? (
          <div style={styles.empty}>No hay listas registradas.</div>
        ) : (
          <div style={styles.tableWrap}><table className="master-table" style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Comprador</th>
                <th>Fecha</th>
                <th>Comuna</th>
                <th>Producto</th>
                <th>Formato</th>
                <th>Marca</th>
                <th>Cantidad</th>
                <th>Precio objetivo</th>
              </tr>
            </thead>
            <tbody>
              {listas.map((lista, index) => (
                <tr key={getListaId(lista) ?? index}>
                  <td>{getListaId(lista) ?? '—'}</td>
                  <td>{lista.compradorDisplay}</td>
                  <td>{lista.fecha_creacion?.split('T')[0] ?? '—'}</td>
                  <td>{lista.comuna_despacho ?? '—'}</td>
                  <td>{lista.producto ?? '—'}</td>
                  <td>{lista.formato ?? '—'}</td>
                  <td>{lista.marca ?? '—'}</td>
                  <td>{lista.cantidad ?? '—'}</td>
                  <td>
                    {lista.precio != null && lista.precio !== ''
                      ? `$${lista.precio}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeading}><div><span style={styles.count}>{ofertas.length}</span><h2 style={styles.sectionTitle}>Ofertas realizadas</h2></div><p style={styles.sectionText}>Propuestas enviadas por proveedores.</p></div>
        {ofertas.length === 0 ? (
          <div style={styles.empty}>No hay ofertas registradas.</div>
        ) : (
          <div style={styles.tableWrap}><table className="master-table" style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Lista</th>
                <th>Proveedor</th>
                <th>Producto</th>
                <th>Precio ofertado</th>
                <th>Incluye despacho</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((oferta) => (
                <tr key={oferta.id}>
                  <td>{oferta.id}</td>
                  <td>{oferta.lista_id ?? '—'}</td>
                  <td>{oferta.proveedorDisplay}</td>
                  <td>{oferta.producto ?? '—'}</td>
                  <td>
                    {oferta.precio_ofertado != null &&
                    oferta.precio_ofertado !== ''
                      ? `$${oferta.precio_ofertado}`
                      : '—'}
                  </td>
                  <td>{oferta.incluye_despacho ? 'Sí' : 'No'}</td>
                  <td>{estadoTexto(oferta.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>
      </div>
      <style jsx>{`
        .master-table th { padding: 14px 16px; color: #50617a; background: #f5f8fd; border-bottom: 1px solid #e2e9f3; font-size: 11px; letter-spacing: .05em; text-align: left; text-transform: uppercase; white-space: nowrap; }
        .master-table td { padding: 14px 16px; color: #50617a; border-bottom: 1px solid #edf1f7; font-size: 13px; white-space: nowrap; }
        .master-table tbody tr:hover { background: #f8fbff; }
        @media (max-width: 680px) { .master-table th, .master-table td { padding: 12px; } }
      `}</style>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', position: 'relative', padding: 'clamp(14px, 3vw, 32px)', background: 'linear-gradient(145deg, #f8fbff, #eef5ff 50%, #f8fcfb)' },
  glow: { position: 'fixed', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 10% 10%, rgba(23,107,255,.1), transparent 30%), radial-gradient(circle at 90% 85%, rgba(0,194,168,.08), transparent 28%)' },
  container: { position: 'relative', width: '100%', maxWidth: 1500, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 22, flexWrap: 'wrap', marginBottom: 24, padding: 'clamp(22px, 4vw, 34px)', color: '#fff', borderRadius: 24, background: 'linear-gradient(135deg, #061b41, #12396f)', boxShadow: '0 22px 50px rgba(6,27,65,.2)' },
  eyebrow: { color: '#7ddcf0', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' },
  title: { fontSize: 'clamp(27px, 4vw, 38px)', margin: '6px 0', color: '#fff' },
  subtitle: { margin: 0, color: '#c8d7ee', lineHeight: 1.5 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  backButton: {
    padding: '11px 15px', borderRadius: 12, border: '1px solid rgba(255,255,255,.25)', color: '#fff', background: 'rgba(255,255,255,.1)', fontWeight: 800,
    cursor: 'pointer',
  },
  logoutButton: {
    padding: '11px 15px', backgroundColor: '#fff', color: '#b42318', border: 'none', borderRadius: 12, fontWeight: 800,
    cursor: 'pointer',
  },
  section: {
    marginBottom: 24, padding: 'clamp(20px, 3vw, 30px)', border: '1px solid #e0e8f4', borderRadius: 22, background: '#fff', boxShadow: '0 16px 42px rgba(20,55,120,.09)',
  },
  sectionHeading: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 15, flexWrap: 'wrap', marginBottom: 20 },
  sectionTitle: { display: 'inline', margin: '0 0 0 10px', color: '#061b41', fontSize: 22 },
  sectionText: { margin: 0, color: '#718097', fontSize: 14 },
  count: { display: 'inline-flex', minWidth: 34, height: 34, alignItems: 'center', justifyContent: 'center', padding: '0 8px', color: '#176bff', background: '#edf4ff', borderRadius: 10, fontWeight: 900 },
  tableWrap: { width: '100%', overflowX: 'auto', border: '1px solid #e5ebf4', borderRadius: 15 },
  table: {
    width: '100%',
    minWidth: 1050,
    borderCollapse: 'collapse',
  },
  empty: { display: 'grid', placeItems: 'center', minHeight: 150, color: '#718097', background: '#f8fbff', border: '1px dashed #cfdaea', borderRadius: 15 },
};
