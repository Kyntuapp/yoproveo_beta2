import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function DatosContactoComprador() {
  const router = useRouter();

  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [comuna, setComuna] = useState('');
  const [region, setRegion] = useState('');
  const [nombreContacto, setNombreContacto] = useState('');
  const [referenciaEntrega, setReferenciaEntrega] = useState('');
  const [authUserId, setAuthUserId] = useState('');
  const [loading, setLoading] = useState(true);

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
        .select(
          'telefono_contacto, direccion, comuna, region, nombre_contacto, referencia_entrega'
        )
        .eq('auth_id', userId)
        .eq('tipo', 'comprador')
        .maybeSingle();

      if (perfil) {
        setTelefono(perfil.telefono_contacto || '');
        setDireccion(perfil.direccion || '');
        setComuna(perfil.comuna || '');
        setRegion(perfil.region || '');
        setNombreContacto(perfil.nombre_contacto || '');
        setReferenciaEntrega(perfil.referencia_entrega || '');
      }

      setLoading(false);
    };

    cargarDatos();
  }, [router]);

  const guardarDatos = async () => {
    if (!telefono.trim() || !direccion.trim() || !comuna.trim()) {
      alert('Completa teléfono, dirección y comuna.');
      return;
    }

    const { error } = await supabase
      .from('perfiles')
      .update({
        telefono_contacto: telefono.trim(),
        direccion: direccion.trim(),
        comuna: comuna.trim().toUpperCase(),
        region: region.trim(),
        nombre_contacto: nombreContacto.trim(),
        referencia_entrega: referenciaEntrega.trim(),
      })
      .eq('auth_id', authUserId)
      .eq('tipo', 'comprador');

    if (error) {
      alert('Error al guardar: ' + error.message);
      return;
    }

    alert('Datos actualizados correctamente');
    router.push('/comprador');
  };

  const volver = () => router.push('/comprador');

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.backgroundGlow}></div>
        <p style={styles.loading}>Cargando…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow}></div>

      <img src="/yoproveo_logo_mvp.png" alt="" style={styles.watermark} />

      <div style={styles.topBar}>
        <div style={styles.leftActions}>
          <button onClick={volver} style={styles.secondaryButton}>
            Volver al panel
          </button>
        </div>

        <div style={styles.centerTitle}>
          <h1 style={styles.title}>Actualizar Datos</h1>
        </div>

        <div style={styles.rightActions}>
          <button onClick={cerrarSesion} style={styles.logoutButton}>
            Cerrar sesión
          </button>
        </div>
      </div>

      <main style={styles.content}>
        <section style={styles.card}>
          <img src="/icono_1.png" alt="Kyntü" style={styles.logo} />

          <h2 style={styles.cardTitle}>Datos de entrega</h2>

          <p style={styles.subtitle}>
            Estos datos se usarán para coordinar la entrega de tus compras.
          </p>

          <div style={styles.formGroup}>
            <label style={styles.label}>Nombre de contacto</label>
            <input
              value={nombreContacto}
              onChange={(e) => setNombreContacto(e.target.value)}
              placeholder="Ej: Miranda Naranjo"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Teléfono</label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+569XXXXXXXX"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Dirección</label>
            <input
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej: Av. Siempre Viva 123"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Comuna</label>
            <input
              value={comuna}
              onChange={(e) => setComuna(e.target.value.toUpperCase())}
              placeholder="Ej: Santiago"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Región</label>
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Ej: Región Metropolitana"
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Referencia de entrega</label>
            <textarea
              value={referenciaEntrega}
              onChange={(e) => setReferenciaEntrega(e.target.value)}
              placeholder="Ej: Dejar en conserjería, local 302, casa azul..."
              style={styles.textArea}
            />
          </div>

          <div style={styles.actionRow}>
            <button onClick={guardarDatos} style={styles.mainButton}>
              Guardar cambios
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg, #1f5cff 0%, #071426 42%, #050b18 100%)',
    position: 'relative',
    overflowX: 'hidden',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  backgroundGlow: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 18% 18%, rgba(31, 92, 255, 0.38), transparent 32%), radial-gradient(circle at 80% 75%, rgba(0, 255, 195, 0.10), transparent 28%)',
    zIndex: 1,
  },
  watermark: {
    position: 'absolute',
    top: '35px',
    left: '45px',
    width: '260px',
    opacity: 0.08,
    zIndex: 1,
    filter: 'drop-shadow(0 0 18px rgba(0,255,210,0.55))',
    pointerEvents: 'none',
  },
  topBar: {
    position: 'relative',
    zIndex: 3,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    marginBottom: '32px',
  },
  leftActions: { display: 'flex', justifyContent: 'flex-start' },
  centerTitle: { display: 'flex', justifyContent: 'center' },
  rightActions: { display: 'flex', justifyContent: 'flex-end' },
  title: {
    color: '#ffffff',
    fontSize: '38px',
    fontWeight: 800,
    margin: 0,
    textAlign: 'center',
    textShadow: '0 3px 12px rgba(0,0,0,0.35)',
  },
  content: {
    position: 'relative',
    zIndex: 3,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: 'min(560px, 100%)',
    background: 'rgba(5, 12, 29, 0.86)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '28px',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.35)',
    padding: '38px 34px',
    boxSizing: 'border-box',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logo: {
    width: '220px',
    marginBottom: '-18px',
    filter: 'drop-shadow(0 0 28px rgba(0,255,210,0.45))',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: '28px',
    margin: '0 0 10px',
    fontWeight: 800,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: '14px',
    lineHeight: 1.5,
    textAlign: 'center',
    margin: '0 0 28px',
    maxWidth: '420px',
  },
  formGroup: { width: '100%', marginBottom: '18px' },
  label: {
    display: 'block',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '13px 15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textArea: {
    width: '100%',
    minHeight: '80px',
    padding: '13px 15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  actionRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginTop: '12px',
  },
  mainButton: {
    background: 'linear-gradient(135deg, #176BFF, #2E6BFF)',
    color: '#fff',
    border: 'none',
    padding: '13px 32px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
    boxShadow: '0 10px 24px rgba(23, 107, 255, 0.32)',
  },
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    padding: '12px 22px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },
  logoutButton: {
    background: 'rgba(255, 80, 80, 0.14)',
    color: '#ffffff',
    border: '1px solid rgba(255, 80, 80, 0.25)',
    padding: '12px 22px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '14px',
  },
  loading: {
    position: 'relative',
    zIndex: 3,
    color: '#ffffff',
    textAlign: 'center',
    paddingTop: '80px',
    fontSize: '18px',
    fontWeight: 700,
  },
};