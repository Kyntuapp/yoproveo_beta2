import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function MasterPanel() {
  const router = useRouter();

  const [listas, setListas] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [perfiles, setPerfiles] = useState({});

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  useEffect(() => {
    const fetchData = async () => {
      // 1. Obtener todas las listas de compra
      const { data: listasCompra, error: errorListas } = await supabase
        .from('listas_compras')
        .select('*');

      // 2. Obtener todas las ofertas
      const { data: ofertasProveedor, error: errorOfertas } = await supabase
        .from('ofertas')
        .select('*');

      // 3. Obtener todos los perfiles
      const { data: perfilesData, error: errorPerfiles } = await supabase
        .from('perfiles')
        .select('id, correo');

      // 4. Crear un diccionario para lookup rápido de emails por ID
      const perfilMap = {};
      perfilesData?.forEach((perfil) => {
        perfilMap[perfil.id] = perfil.correo;
      });

      if (listasCompra) setListas(listasCompra);
      if (ofertasProveedor) setOfertas(ofertasProveedor);
      if (perfilesData) setPerfiles(perfilMap);
    };

    fetchData();
  }, []);

  return (
    <div style={styles.container}>
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
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {listas.map((lista) => (
                <tr key={lista.identificación}>
                  <td>{lista.identificación}</td>
                  <td>{perfiles[lista["ID de usuario"]] || 'Desconocido'}</td>
                  <td>{lista.fecha_creacion?.split('T')[0]}</td>
                  <td>{lista.comuna_despacho}</td>
                  <td>{lista.producto}</td>
                  <td>${lista.precio_referencial}</td>
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
                <th>Proveedor</th>
                <th>Producto</th>
                <th>Precio</th>
                <th>Incluye despacho</th>
              </tr>
            </thead>
            <tbody>
              {ofertas.map((oferta) => (
                <tr key={oferta.id}>
                  <td>{oferta.id}</td>
                  <td>{oferta.email_proveedor}</td>
                  <td>{oferta.producto}</td>
                  <td>${oferta.precio}</td>
                  <td>{oferta.incluye_despacho ? 'Sí' : 'No'}</td>
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

