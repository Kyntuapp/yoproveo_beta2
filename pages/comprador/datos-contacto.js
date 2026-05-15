import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function DatosContactoComprador() {
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [comuna, setComuna] = useState('');
  const [authUserId, setAuthUserId] = useState('');
  const router = useRouter();

  useEffect(() => {
    const cargarDatos = async () => {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData?.user) {
        router.push('/login');
        return;
      }

      const userId = userData.user.id;
      setAuthUserId(userId);

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('telefono_contacto, direccion, comuna')
        .eq('auth_id', userId)
        .eq('tipo', 'comprador')
        .single();

      if (perfil) {
        setTelefono(perfil.telefono_contacto || '');
        setDireccion(perfil.direccion || '');
        setComuna(perfil.comuna || '');
      }
    };

    cargarDatos();
  }, []);

  const guardarDatos = async () => {
    const { error } = await supabase
      .from('perfiles')
      .update({
        telefono_contacto: telefono,
        direccion,
        comuna,
      })
      .eq('auth_id', authUserId)
      .eq('tipo', 'comprador');

    if (error) {
      alert('Error al guardar: ' + error.message);
    } else {
      alert('Datos actualizados correctamente');
      router.push('/comprador');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Actualizar datos de contacto</h2>

      <div style={{ marginBottom: 10 }}>
        <label>Teléfono:</label>
        <br />
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Dirección:</label>
        <br />
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label>Comuna:</label>
        <br />
        <input
          value={comuna}
          onChange={(e) => setComuna(e.target.value)}
        />
      </div>

      <button onClick={guardarDatos}>Guardar</button>
    </div>
  );
}