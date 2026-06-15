import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Notificaciones({ userId, rol }) {
  const router = useRouter();
  const [mostrar, setMostrar] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    if (!userId) return;
    cargarNotificaciones();
  }, [userId]);

  const cargarNotificaciones = async () => {
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', userId)
      .eq('rol', rol)
      .eq('leida', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar notificaciones:', error.message);
      return;
    }

    setNotificaciones(data || []);
  };

  const marcarLeidaYRedirigir = async (notif) => {
    setNotificaciones((prev) => prev.filter((n) => n.id !== notif.id));

    await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notif.id);

    router.push(notif.ruta || '/');
  };

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setMostrar(true)}
      onMouseLeave={() => setMostrar(false)}
    >
      {/* 🔔 Campana */}
      <div style={{ position: 'relative', cursor: 'pointer', fontSize: 22 }}>
        🔔
        {noLeidas > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              background: 'red',
              color: 'white',
              borderRadius: '50%',
              fontSize: 12,
              minWidth: 18,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
            }}
          >
            {noLeidas}
          </span>
        )}
      </div>

      {/* 📦 Popup */}
      {mostrar && (
        <div
          style={{
            position: 'absolute',
            top: 28,
            right: 0,
            width: 320,
            maxHeight: 350,
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            padding: 10,
          }}
        >
          <h4 style={{ margin: '0 0 10px 0' }}>Notificaciones</h4>

          {notificaciones.length === 0 ? (
            <p style={{ margin: 0 }}>No tienes notificaciones.</p>
          ) : (
            notificaciones.map((notif) => (
              <div
                key={notif.id}
                onClick={() => marcarLeidaYRedirigir(notif)}
                style={{
                  padding: 10,
                  marginBottom: 8,
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: notif.leida ? '#f5f5f5' : '#fff8dc',
                  border: '1px solid #ddd',
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{notif.titulo}</div>
                <div style={{ fontSize: 13 }}>{notif.mensaje}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}