// pages/proveedor/datos-contacto.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import { resolveProveedorProfile } from '../../lib/resolveProveedorProfile';

export default function DatosContactoProveedor() {
  const router = useRouter();

  const [perfil, setPerfil] = useState(null);
  const [emailContacto, setEmailContacto] = useState('');
  const [fono8, setFono8] = useState('');
  const [loading, setLoading] = useState(true);
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [rutTitular, setRutTitular] = useState('');
  const [nombreTitular, setNombreTitular] = useState('');

  useEffect(() => {
    const cargar = async () => {
      const { data: userWrap, error: userErr } = await supabase.auth.getUser();

      if (userErr || !userWrap?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { perfil: perfilData } = await resolveProveedorProfile(userWrap.user, {
        select: '*',
      });

      if (!perfilData) {
        alert(
          'No se encontró perfil de proveedor.\nVe a "Cambiar perfil" y crea/selecciona el perfil de proveedor.'
        );
        router.push('/proveedor');
        return;
      }

      setPerfil(perfilData);
      setEmailContacto(perfilData.email_contacto ?? perfilData.email ?? '');

      const tel = (perfilData.telefono_contacto || '')
        .replace('+569', '')
        .replace(/\D/g, '')
        .slice(0, 8);

      setFono8(tel);
      setBanco(perfilData.banco || '');
      setTipoCuenta(perfilData.tipo_cuenta || '');
      setNumeroCuenta(perfilData.numero_cuenta || '');
      setRutTitular(perfilData.rut_titular || '');
      setNombreTitular(perfilData.nombre_titular || '');
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
        banco,
        tipo_cuenta: tipoCuenta,
        numero_cuenta: numeroCuenta,
        rut_titular: rutTitular,
        nombre_titular: nombreTitular,
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

      <img
        src="/yoproveo_logo_mvp.png"
        alt=""
        style={styles.watermark}
      />

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
          <img
            src="/icono_1.png"
            alt="Kyntü"
            style={styles.logo}
          />

          <h2 style={styles.cardTitle}>Datos de contacto</h2>

          <p style={styles.subtitle}>
            Estos datos serán visibles para el comprador cuando acepte una de tus ofertas.
          </p>

          <div style={styles.formGroup}>
            <label style={styles.label}>Correo de contacto</label>

            <input
              type="email"
              value={emailContacto}
              onChange={(e) => setEmailContacto(e.target.value)}
              placeholder="ej: ventas@tuempresa.cl"
              style={styles.input}
            />

            <small style={styles.helpText}>
              Usa el correo donde quieres recibir comunicaciones comerciales.
            </small>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Teléfono de contacto</label>

            <div style={styles.phoneRow}>
              <div style={styles.prefix}>+569</div>

              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={fono8}
                onChange={(e) => setFono8(normalizar8(e.target.value))}
                placeholder="XXXXXXXX"
                style={styles.phoneInput}
              />
            </div>

            <small style={styles.helpText}>
              Ingresa solo los 8 dígitos finales.
            </small>
          </div>

          <h2 style={styles.cardTitle}>Datos bancarios</h2>

          <div style={styles.formGroup}>
            <label style={styles.label}>Banco</label>

            <input
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              style={styles.input}
              placeholder="Banco de Chile"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Tipo de cuenta</label>

            <input
              value={tipoCuenta}
              onChange={(e) => setTipoCuenta(e.target.value)}
              style={styles.input}
              placeholder="Cuenta Corriente"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Número de cuenta</label>

            <input
              value={numeroCuenta}
              onChange={(e) => setNumeroCuenta(e.target.value)}
              style={styles.input}
              placeholder="123456789"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>RUT titular</label>

            <input
              value={rutTitular}
              onChange={(e) => setRutTitular(e.target.value)}
              style={styles.input}
              placeholder="12345678-9"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Nombre titular</label>

            <input
              value={nombreTitular}
              onChange={(e) => setNombreTitular(e.target.value)}
              style={styles.input}
              placeholder="Juan Pérez"
            />
          </div>

          <div style={styles.actionRow}>
            <button onClick={guardar} style={styles.mainButton}>
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

  leftActions: {
    display: 'flex',
    justifyContent: 'flex-start',
  },

  centerTitle: {
    display: 'flex',
    justifyContent: 'center',
  },

  rightActions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },

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

  formGroup: {
    width: '100%',
    marginBottom: '18px',
  },

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

  phoneRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
  },

  prefix: {
    padding: '13px 15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    fontWeight: 800,
    minWidth: '70px',
    textAlign: 'center',
    boxSizing: 'border-box',
  },

  phoneInput: {
    flex: 1,
    padding: '13px 15px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
    outline: 'none',
    fontSize: '14px',
    boxSizing: 'border-box',
  },

  helpText: {
    display: 'block',
    color: 'rgba(255, 255, 255, 0.58)',
    fontSize: '12px',
    marginTop: '7px',
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