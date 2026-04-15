import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function SolicitudesProveedor() {
  const router = useRouter();
  const [proveedorId, setProveedorId] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/login');
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .single();

      if (perfilError || !perfil) {
        alert('No se encontró el perfil de proveedor.');
        router.push('/proveedor');
        return;
      }

      setProveedorId(perfil.id);

      const { data: solicitudesData, error: solicitudesError } = await supabase
        .from('solicitudes_productos')
        .select('*')
        .eq('proveedor_id', perfil.id)

      if (solicitudesError) {
        alert('Error al cargar solicitudes: ' + solicitudesError.message);
      } else {
        setSolicitudes(solicitudesData || []);
      }

      setLoading(false);
    };

    cargarDatos();
  }, [router]);

  const volver = () => router.push('/proveedor/catalogo');

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <button onClick={volver}>Volver</button>
        <h2>Estado de solicitudes</h2>
        <div style={{ width: 80 }} />
      </div>

      {solicitudes.length === 0 ? (
        <p style={{ textAlign: 'center' }}>No tienes solicitudes registradas.</p>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <table
            style={{
              borderCollapse: 'collapse',
              minWidth: '900px',
            }}
            border="1"
            cellPadding="8"
          >
            <thead>
              <tr>
                <th>Producto</th>
                <th>Marca</th>
                <th>Formato</th>
                <th>Cantidad referencia</th>
                <th>Estado</th>
                <th>Comentario administrador</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((solicitud) => (
                <tr key={solicitud.identificación || solicitud.id}>
                  <td>{solicitud.nombre}</td>
                  <td>{solicitud.marca}</td>
                  <td>{solicitud.formato}</td>
                  <td>{solicitud.cantidad_disponible ?? solicitud.cantidad_referencia ?? 0}</td>
                  <td>{solicitud.estado}</td>
                  <td>{solicitud.comentario_admin || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}