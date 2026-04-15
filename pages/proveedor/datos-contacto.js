// pages/proveedor/datos-contacto.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function DatosContactoProveedor() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [emailContacto, setEmailContacto] = useState('');
  const [fono8, setFono8] = useState(''); // solo 8 dígitos; prefijo +569 fijo
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const { data: userWrap, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userWrap?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }
      const user = userWrap.user;

      // 1) Buscar por auth_id + tipo proveedor
      let { data: perfilData, error: perfilErr } = await supabase
        .from('perfiles')
        .select('*')
        .eq('auth_id', user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      // 2) Si no existe, buscar por email + tipo proveedor (fallback que ya usas en comprador)
      if (!perfilData) {
        const { data: perfByEmail } = await supabase
          .from('perfiles')
          .select('*')
          .eq('email', user.email)
          .eq('tipo', 'proveedor')
          .maybeSingle();
        perfilData = perfByEmail || null;
      }

      if (!perfilData) {
        alert('No se encontró perfil de proveedor.\nVe a "Cambiar perfil" y crea/selecciona el perfil de proveedor.');
        router.push('/proveedor');
        return;
      }

      setPerfil(perfilData);

      // Prefills tolerantes
      setEmailContacto(perfilData.email_contacto ?? perfilData.email ?? '');
      const tel = (perfilData.telefono_contacto || '').replace('+569', '').replace(/\D/g, '').slice(0, 8);
      setFono8(tel);
      setLoading(false);
    };
    cargar();
  }, [router]);

  const normalizar8 = (v) => v.replace(/\D/g, '').slice(0, 8);

  const guardar = async () => {
    if (!perfil) return;

    if (!emailContacto?.trim()) {
      alert('Ingresa un correo de contacto.');
      return;
    }
    const solo8 = normalizar8(fono8);
    if (solo8.length !== 8) {
      alert('El teléfono debe tener exactamente 8 dígitos después de +569.');
      return;
    }

    const { error } = await supabase
      .from('perfiles')
      .update({
        email_contacto: emailContacto.trim(),
        telefono_contacto: `+569${solo8}`,
      })
      .eq('id', perfil.id);

    if (error) {
      alert('No se pudieron guardar los datos: ' + error.message);
      return;
    }
    alert('Datos de contacto actualizados.');
    router.push('/proveedor');
  };

  const volver = () => router.push('/proveedor');

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center' }}>Cargando…</div>;

  return (
    <div style={{ padding: 20 }}>
      {/* Barra superior */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={volver}>Volver al panel</button>
        <h2>Actualizar datos de contacto</h2>
        <button onClick={cerrarSesion}>Cerrar sesión</button>
      </div>

      {/* Formulario */}
      <div style={{ maxWidth: 520, margin: '0 auto', border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Correo de contacto</label>
          <input
            type="email"
            value={emailContacto}
            onChange={(e) => setEmailContacto(e.target.value)}
            placeholder="ej: ventas@tuempresa.cl"
            style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
          />
          <small style={{ color: '#666' }}>
            Este correo lo verá el comprador al aceptar tu oferta.
          </small>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Teléfono de contacto</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                padding: '8px 10px',
                border: '1px solid #ccc',
                borderRadius: 8,
                background: '#f7f7f7',
                minWidth: 64,
                textAlign: 'center',
              }}
            >
              +569
            </div>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              value={fono8}
              onChange={(e) => setFono8(normalizar8(e.target.value))}
              placeholder="XXXXXXXX"
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ccc' }}
            />
          </div>
          <small style={{ color: '#666' }}>
            Solo ingresa los 8 dígitos finales. Se usará el formato +569XXXXXXXX.
          </small>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={guardar}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
