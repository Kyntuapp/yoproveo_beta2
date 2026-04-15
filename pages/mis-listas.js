import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function MisListas() {
  const [listas, setListas] = useState([]);
  const [usuarioId, setUsuarioId] = useState('');
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
      setListas(data);
    }
  };

  const volver = () => {
    router.push('/comprador');
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '30px' }}>
      <h2>Mis listas de compras</h2>
      {listas.length === 0 ? (
        <p>No tienes listas registradas.</p>
      ) : (
        <table style={{ margin: 'auto', borderCollapse: 'collapse', border: '1px solid gray' }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Marca</th>
              <th>Formato</th>
              <th>Precio</th>
            </tr>
          </thead>
          <tbody>
            {listas.map((item, idx) => (
              <tr key={idx}>
                <td>{new Date(item.fecha_envio).toLocaleString()}</td>
                <td>{item.producto}</td>
                <td>{item.cantidad}</td>
                <td>{item.marca}</td>
                <td>{item.formato}</td>
                <td>${item.precio}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <br />
      <button onClick={volver}>Volver al panel</button>
    </div>
  );
}
