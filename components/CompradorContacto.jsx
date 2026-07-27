import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CompradorContacto({
  usuarioAuthId,
  listaCompraId,
  comunaDespacho,
  styles: parentStyles,
}) {
  const [contacto, setContacto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!usuarioAuthId) {
      setCargando(false);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError('');

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('email, email_contacto, telefono_contacto, direccion, comuna')
        .eq('tipo', 'comprador')
        .eq('auth_id', usuarioAuthId)
        .maybeSingle();

      if (!activo) return;

      if (perfilError) {
        setError('No se pudo cargar el contacto del comprador.');
        setCargando(false);
        return;
      }

      let direccionEnvio = '';
      if (listaCompraId) {
        const { data: listaRow } = await supabase
          .from('listas_compras')
          .select('direccion_envio, comuna_despacho')
          .eq('id', listaCompraId)
          .maybeSingle();

        if (listaRow) {
          direccionEnvio =
            listaRow.direccion_envio ||
            listaRow.comuna_despacho ||
            comunaDespacho ||
            '';
        }
      }

      setContacto({
        ...perfil,
        direccionFinal:
          [perfil?.direccion, perfil?.comuna].filter(Boolean).join(', ') ||
          direccionEnvio ||
          'No disponible',
      });
      setCargando(false);
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [usuarioAuthId, listaCompraId, comunaDespacho]);

  const s = parentStyles || {};

  if (cargando) {
    return <p style={s.contactText}>Cargando contacto del comprador…</p>;
  }

  if (error) {
    return <p style={s.contactText}>{error}</p>;
  }

  return (
    <div style={s.contactText}>
      <p>
        <strong>Correo:</strong>{' '}
        {contacto?.email_contacto || contacto?.email || 'N/A'}
      </p>
      <p>
        <strong>Teléfono:</strong>{' '}
        {contacto?.telefono_contacto || 'No disponible'}
      </p>
      <p>
        <strong>Dirección de despacho:</strong> {contacto?.direccionFinal}
      </p>
    </div>
  );
}
