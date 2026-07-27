import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ProveedorContacto({ proveedorId, styles: parentStyles }) {
  const [contacto, setContacto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!proveedorId) {
      setCargando(false);
      return;
    }

    let activo = true;

    const cargar = async () => {
      setCargando(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('perfiles')
        .select('email, email_contacto, telefono_contacto')
        .eq('id', proveedorId)
        .maybeSingle();

      if (!activo) return;

      if (fetchError) {
        setError('No se pudo cargar el contacto del proveedor.');
        setCargando(false);
        return;
      }

      setContacto(data);
      setCargando(false);
    };

    cargar();

    return () => {
      activo = false;
    };
  }, [proveedorId]);

  const s = parentStyles || {};

  if (cargando) {
    return <p style={s.contactText}>Cargando contacto del proveedor…</p>;
  }

  if (error) {
    return <p style={s.contactText}>{error}</p>;
  }

  return (
    <div style={s.contactBox}>
      <p style={s.contactText}>
        <strong>Proveedor:</strong>{' '}
        {contacto?.email_contacto || contacto?.email || 'No disponible'}
      </p>
      <p style={s.contactText}>
        <strong>Teléfono:</strong>{' '}
        {contacto?.telefono_contacto || 'No disponible'}
      </p>
    </div>
  );
}
