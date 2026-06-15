import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

export default function MasterSolicitudes() {
  const router = useRouter();
  const { authorized, loading } = useRequireMaster();
  const [solicitudes, setSolicitudes] = useState([]);

  useEffect(() => {
    if (!authorized) return;
    cargarSolicitudes();
  }, [authorized]);

  const cargarSolicitudes = async () => {
    const { data, error } = await supabase
      .from('solicitudes_productos')
      .select('*');

    if (error) {
      alert('Error al cargar solicitudes: ' + error.message);
      return;
    }

    setSolicitudes(data || []);
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

    const yaExisteEnCatalogo = (catalogoData || []).some((item) => {
      return (
        (item.nombre || '').trim().toUpperCase() === (nombre || '').trim().toUpperCase() &&
        (item.marca || '').trim().toUpperCase() === (marca || '').trim().toUpperCase() &&
        (item.formato || '').replace(/\s+/g, '').trim().toUpperCase() ===
          (formato || '').replace(/\s+/g, '').trim().toUpperCase()
      );
    });

    if (!yaExisteEnCatalogo) {
      const { error: insertCatalogoError } = await supabase
        .from('catalogo_productos')
        .insert([
          {
            nombre,
            marca,
            formato,
          },
        ]);

      if (insertCatalogoError) {
        alert('Error al insertar en catálogo: ' + insertCatalogoError.message);
        return;
      }
    }

    const { error: insertProveedorError } = await supabase
      .from('productos_proveedores')
      .insert([
        {
          proveedor_id: proveedorId,
          nombre,
          marca,
          formato,
          cantidad_disponible: solicitud.cantidad_disponible || 0,
        },
      ]);

    if (insertProveedorError) {
      alert('Error al agregar producto al proveedor: ' + insertProveedorError.message);
      return;
    }

    const solicitudId = solicitud.id ?? solicitud.identificación;

    const { error: updateError } = await supabase
      .from('solicitudes_productos')
      .update({
        estado: 'aprobado',
      })
      .eq(solicitud.id ? 'id' : 'identificación', solicitudId);

    if (updateError) {
      alert('Error al aprobar solicitud: ' + updateError.message);
      return;
    }

    const { error: notifError } = await supabase
      .from('notificaciones')
      .insert([
        {
          usuario_id: proveedorId,
          rol: 'proveedor',
          titulo: 'Solicitud aprobada',
          mensaje: `Tu solicitud para el producto ${nombre} fue aprobada.`,
          ruta: '/proveedor/solicitudes',
          leida: false,
        },
      ]);

    if (notifError) {
      alert('Solicitud aprobada, pero falló la notificación: ' + notifError.message);
      await cargarSolicitudes();
      return;
    }

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

    const { error: notifError } = await supabase
      .from('notificaciones')
      .insert([
        {
          usuario_id: solicitud.proveedor_id,
          rol: 'proveedor',
          titulo: 'Solicitud rechazada',
          mensaje: `Tu solicitud para el producto ${solicitud.nombre} fue rechazada. Motivo: ${motivo || 'Sin comentario.'}`,
          ruta: '/proveedor/solicitudes',
          leida: false,
        },
      ]);

    if (notifError) {
      alert('Solicitud rechazada, pero falló la notificación: ' + notifError.message);
      await cargarSolicitudes();
      return;
    }

    alert('Solicitud rechazada');
    await cargarSolicitudes();
  };

  if (loading || !authorized) {
    return <div style={{ padding: 20 }}>Verificando acceso...</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <button onClick={() => router.push('/master')} style={styles.backButton}>
        ← Volver al panel
      </button>

      <h2>Solicitudes de productos</h2>

      {solicitudes.length === 0 ? (
        <p>No hay solicitudes</p>
      ) : (
        <table border="1" cellPadding="5">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Marca</th>
              <th>Formato</th>
              <th>Cantidad</th>
              <th>Estado</th>
              <th>Comentario admin</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.id ?? s.identificación}>
                <td>{s.nombre}</td>
                <td>{s.marca}</td>
                <td>{s.formato}</td>
                <td>{s.cantidad_disponible ?? s.cantidad_referencia ?? 0}</td>
                <td>{s.estado}</td>
                <td>{s.comentario_admin || '-'}</td>
                <td>
                  {s.estado === 'pendiente' ? (
                    <>
                      <button onClick={() => aprobarSolicitud(s)}>
                        Aprobar
                      </button>
                      <button onClick={() => rechazarSolicitud(s)}>
                        Rechazar
                      </button>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  backButton: {
    marginBottom: 16,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
};
