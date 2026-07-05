import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

export default function MasterSolicitudes() {
  const router = useRouter();
  const { authorized, loading } = useRequireMaster();
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    console.log('authorized master:', authorized);
    console.log('loading master:', loading);

    if (!authorized) return;
    cargarSolicitudes();
  }, [authorized, loading]);

  const cargarSolicitudes = async () => {
  console.log('Cargando solicitudes...');

  const { data: solicitudesData, error: solicitudesError } = await supabase
    .from('solicitudes_productos')
    .select('*')
    .order('created_at', { ascending: false });

  if (solicitudesError) {
    console.error('Error al cargar solicitudes:', solicitudesError);
    alert('Error al cargar solicitudes: ' + solicitudesError.message);
    return;
  }

  const proveedorIds = [
    ...new Set((solicitudesData || []).map((s) => s.proveedor_id).filter(Boolean)),
  ];

  const { data: perfilesData, error: perfilesError } = await supabase
    .from('perfiles')
    .select('id, email, tipo')
    .in('id', proveedorIds);

  if (perfilesError) {
    console.error('Error al cargar perfiles:', perfilesError);
  }

  const perfilesPorId = Object.fromEntries(
    (perfilesData || []).map((p) => [String(p.id), p])
  );

  console.log('Proveedor IDs desde solicitudes:', proveedorIds);
console.log('Perfiles encontrados:', perfilesData);

  const solicitudesConPerfil = (solicitudesData || []).map((s) => ({
    ...s,
    perfiles: perfilesPorId[String(s.proveedor_id)] || null,
  }));

  console.log('Solicitudes cargadas:', solicitudesConPerfil);
  setSolicitudes(solicitudesConPerfil);
};

  const aprobarSolicitud = async (solicitud) => {
    const nombre = solicitud.nombre;
    const marca = solicitud.marca;
    const formato = solicitud.formato;
    const proveedorId = solicitud.proveedor_id;

    const { data: catalogoData, error: catalogoError } = await supabase
      .from('catalogo_productos')
      .select('id, nombre, marca, formato');

    if (catalogoError) {
      alert('Error al revisar catálogo: ' + catalogoError.message);
      return;
    }

    const yaExisteEnCatalogo = (catalogoData || []).some((item) => (
      (item.nombre || '').trim().toUpperCase() === (nombre || '').trim().toUpperCase() &&
      (item.marca || '').trim().toUpperCase() === (marca || '').trim().toUpperCase() &&
      (item.formato || '').replace(/\s+/g, '').trim().toUpperCase() ===
        (formato || '').replace(/\s+/g, '').trim().toUpperCase()
    ));

    if (!yaExisteEnCatalogo) {
      const { error: insertCatalogoError } = await supabase
        .from('catalogo_productos')
        .insert([{ nombre, marca, formato }]);

      if (insertCatalogoError) {
        alert('Error al insertar en catálogo: ' + insertCatalogoError.message);
        return;
      }
    }

    const { error: insertProveedorError } = await supabase
      .from('productos_proveedores')
      .insert([{
        proveedor_id: proveedorId,
        nombre,
        marca,
        formato,
        cantidad_disponible: solicitud.cantidad_disponible || 0,
      }]);

    if (insertProveedorError) {
      alert('Error al agregar producto al proveedor: ' + insertProveedorError.message);
      return;
    }

    const solicitudId = solicitud.id ?? solicitud.identificación;

    const { error: updateError } = await supabase
      .from('solicitudes_productos')
      .update({ estado: 'aprobado' })
      .eq(solicitud.id ? 'id' : 'identificación', solicitudId);

    if (updateError) {
      alert('Error al aprobar solicitud: ' + updateError.message);
      return;
    }

    await supabase.from('notificaciones').insert([{
      usuario_id: proveedorId,
      rol: 'proveedor',
      titulo: 'Solicitud aprobada',
      mensaje: `Tu solicitud para el producto ${nombre} fue aprobada.`,
      ruta: '/proveedor/solicitudes',
      leida: false,
    }]);

    alert('Solicitud aprobada');
    await cargarSolicitudes();
  };

  const rechazarSolicitud = async (solicitud) => {
    const motivo = prompt('Motivo del rechazo:');
    if (motivo === null) return;

    const solicitudId = solicitud.id ?? solicitud.identificación;

    const { error: updateError } = await supabase
      .from('solicitudes_productos')
      .update({
        estado: 'rechazado',
        comentario_admin: motivo || '',
      })
      .eq(solicitud.id ? 'id' : 'identificación', solicitudId);

    if (updateError) {
      alert('Error al rechazar: ' + updateError.message);
      return;
    }

    await supabase.from('notificaciones').insert([{
      usuario_id: solicitud.proveedor_id,
      rol: 'proveedor',
      titulo: 'Solicitud rechazada',
      mensaje: `Tu solicitud para el producto ${solicitud.nombre} fue rechazada. Motivo: ${motivo || 'Sin comentario.'}`,
      ruta: '/proveedor/solicitudes',
      leida: false,
    }]);

    alert('Solicitud rechazada');
    await cargarSolicitudes();
  };

  if (loading || !authorized) {
    return (
      <div style={styles.page}>
        <p style={styles.emptyText}>Verificando acceso...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <main style={styles.container}>
        <button onClick={() => router.push('/master')} style={styles.backButton}>
          ← Volver al panel
        </button>

        <section style={styles.hero}>
          <p style={styles.badge}>MASTER</p>
          <h1 style={styles.title}>Solicitudes de productos</h1>
          <p style={styles.subtitle}>
            Revisa las solicitudes enviadas por proveedores y aprueba los productos para el catálogo.
          </p>
        </section>

        <section style={styles.card}>
          <img src="/icono_1.png" alt="Kyntü" style={styles.logo} />

          {solicitudes.length === 0 ? (
            <p style={styles.emptyText}>No hay solicitudes</p>
          ) : (
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Producto</th>
                    <th style={styles.th}>Marca</th>
                    <th style={styles.th}>Formato</th>
                    <th style={styles.th}>Cantidad</th>
                    <th style={styles.th}>Solicitante</th>
                    <th style={styles.th}>Estado</th>
                    <th style={styles.th}>Comentario admin</th>
                    <th style={styles.th}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.id ?? s.identificación}>
                      <td style={styles.td}>{s.nombre}</td>
                      <td style={styles.td}>{s.marca}</td>
                      <td style={styles.td}>{s.formato}</td>
                      <td style={styles.td}>
                        {s.cantidad_disponible ?? s.cantidad_referencia ?? 0}
                      </td>
                      <td style={styles.td}>
                        <strong>{s.perfiles?.email || 'Sin correo'}</strong>
                        <br />
                        <span style={styles.subText}>
                          ID: {s.proveedor_id}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <span style={getEstadoStyle(s.estado)}>
                          {s.estado}
                        </span>
                      </td>
                      <td style={styles.td}>{s.comentario_admin || '-'}</td>
                      <td style={styles.td}>
                        {s.estado === 'pendiente' ? (
                          <div style={styles.actions}>
                            <button onClick={() => aprobarSolicitud(s)} style={styles.approveButton}>
                              Aprobar
                            </button>
                            <button onClick={() => rechazarSolicitud(s)} style={styles.rejectButton}>
                              Rechazar
                            </button>
                          </div>
                        ) : (
                          <span style={styles.emptyAction}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const getEstadoStyle = (estado) => {
  if (estado === 'pendiente') return styles.statusPending;
  if (estado === 'aprobado') return styles.statusApproved;
  if (estado === 'rechazado') return styles.statusRejected;
  return styles.statusDefault;
};

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f7f9fc',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#061b41',
  },
  container: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '42px 28px',
  },
  backButton: {
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    color: '#176BFF',
    fontWeight: 900,
    fontSize: '15px',
    cursor: 'pointer',
    borderRadius: '12px',
    padding: '12px 18px',
    marginBottom: '42px',
  },
  hero: {
    marginBottom: '30px',
  },
  badge: {
    color: '#176BFF',
    fontWeight: 900,
    letterSpacing: '0.08em',
    fontSize: '13px',
    margin: '0 0 12px',
  },
  title: {
    fontSize: '42px',
    lineHeight: 1.1,
    margin: 0,
    color: '#061b41',
    fontWeight: 900,
  },
  subtitle: {
    color: '#52627a',
    fontSize: '16px',
    lineHeight: 1.7,
    maxWidth: '680px',
    margin: '16px 0 0',
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '24px',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(20, 55, 120, 0.08)',
  },
  logo: {
    position: 'absolute',
    width: '240px',
    opacity: 0.04,
    right: '-40px',
    top: '-20px',
    pointerEvents: 'none',
  },
  tableWrapper: {
    width: '100%',
    overflowX: 'auto',
    position: 'relative',
    zIndex: 2,
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 10px',
  },
  th: {
    color: '#52627a',
    fontSize: '13px',
    fontWeight: 900,
    padding: '10px',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  },
  td: {
    color: '#061b41',
    padding: '15px 10px',
    background: '#f8fafc',
    borderTop: '1px solid #edf1f7',
    borderBottom: '1px solid #edf1f7',
    fontSize: '14px',
    verticalAlign: 'middle',
  },
  subText: {
    color: '#64748b',
    fontSize: '12px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  approveButton: {
    background: '#12b981',
    color: '#ffffff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 900,
  },
  rejectButton: {
    background: '#ef4444',
    color: '#ffffff',
    border: 'none',
    padding: '10px 14px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 900,
  },
  emptyText: {
    color: '#52627a',
    textAlign: 'center',
    fontWeight: 700,
    position: 'relative',
    zIndex: 2,
  },
  emptyAction: {
    color: '#94a3b8',
  },
  statusPending: {
    color: '#f59e0b',
    fontWeight: 900,
  },
  statusApproved: {
    color: '#12b981',
    fontWeight: 900,
  },
  statusRejected: {
    color: '#ef4444',
    fontWeight: 900,
  },
  statusDefault: {
    color: '#061b41',
    fontWeight: 800,
  },
};