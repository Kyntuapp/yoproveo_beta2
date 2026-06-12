import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { useRequireMaster } from '../../lib/useRequireMaster';

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
        alert('Error al cargar listas de compra: ' + listasError.message);
        return;
      }

      const { data: ofertasData, error: ofertasError } = await supabase
        .from('ofertas_productos')
        .select(
          'id, lista_id, proveedor_id, producto, formato, marca, precio_ofertado, incluye_despacho, estado'
        )
        .order('id', { ascending: false });

      if (ofertasError) {
        alert('Error al cargar ofertas: ' + ofertasError.message);
        return;
      }

      const { data: perfilesData, error: perfilesError } = await supabase
        .from('perfiles')
        .select('id, auth_id, tipo, email, email_contacto')
        .in('tipo', ['comprador', 'proveedor']);

      if (perfilesError) {
        alert('Error al cargar perfiles: ' + perfilesError.message);
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
    return <div style={{ padding: '2rem' }}>Verificando acceso...</div>;
  }

  return (
    <div style={styles.container}>
      <button onClick={() => router.push('/master')} style={styles.backButton}>
        ← Volver al panel
      </button>

      <h1 style={styles.title}>Panel Administrador (Perfil Master)</h1>

      <button onClick={handleLogout} style={styles.logoutButton}>
        Cerrar sesión
      </button>

      <section style={styles.section}>
        <h2>🛒 Todas las Listas de Compra</h2>
        {listas.length === 0 ? (
          <p>No hay listas registradas.</p>
        ) : (
          <table style={styles.table}>
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
          </table>
        )}
      </section>

      <section style={styles.section}>
        <h2>📦 Todas las Ofertas Realizadas</h2>
        {ofertas.length === 0 ? (
          <p>No hay ofertas registradas.</p>
        ) : (
          <table style={styles.table}>
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
          </table>
        )}
      </section>
    </div>
  );
}

const styles = {
  container: {
    padding: '2rem',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    fontSize: '28px',
    marginBottom: '1rem',
    color: '#0070f3',
  },
  backButton: {
    marginBottom: 16,
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #ccc',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    marginBottom: '2rem',
    cursor: 'pointer',
  },
  section: {
    marginBottom: '3rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
};
