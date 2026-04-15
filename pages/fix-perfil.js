import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function FixPerfil() {
  const [mensaje, setMensaje] = useState('');
  const router = useRouter();

  useEffect(() => {
    const actualizarPerfil = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setMensaje('Error al obtener el usuario o no estás logueado.');
        return;
      }

      // Cambia esto según el perfil que quieras registrar
      const perfilesDeseados = ['comprador']; // o ['proveedor'], o ['comprador', 'proveedor']

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          perfiles: perfilesDeseados,
        }
      });

      if (updateError) {
        setMensaje('Error al actualizar el perfil: ' + updateError.message);
      } else {
        setMensaje('Perfil actualizado correctamente. Serás redirigido en 3 segundos...');
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      }
    };

    actualizarPerfil();
  }, []);

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Actualizando perfil...</h2>
      <p>{mensaje}</p>
    </div>
  );
}
