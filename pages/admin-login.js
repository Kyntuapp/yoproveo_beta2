import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

// Acceso master: exento del gate legal global en _app.js (esRutaMaster).
// El perfil master no sigue el flujo comprador/proveedor ni aceptaciones v1.0.
export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email.trim() || !password) {
      setErrorMessage('Ingresa tu correo y contraseña');
      return;
    }
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

      if (error || !data.user) {
        setErrorMessage('Credenciales incorrectas');
        return;
      }

    const { data: perfilPorAuth } = await supabase
      .from('perfiles')
      .select('tipo')
      .eq('auth_id', data.user.id)
      .eq('tipo', 'master')
      .maybeSingle();

    let perfilMaster = perfilPorAuth;

    if (!perfilMaster) {
      const { data: perfilPorEmail } = await supabase
        .from('perfiles')
        .select('tipo')
        .eq('email', normalizedEmail)
        .eq('tipo', 'master')
        .maybeSingle();

      perfilMaster = perfilPorEmail;
    }

      if (!perfilMaster) {
        await supabase.auth.signOut();
        setErrorMessage('No tienes permiso para acceder al panel administrador');
        return;
      }

    localStorage.setItem('user_id', data.user.id);
    localStorage.setItem('user_email', data.user.email ?? normalizedEmail);
    localStorage.setItem('login_time', Date.now().toString());
    localStorage.setItem('last_activity', Date.now().toString());

      router.push('/master');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.glow} />
      <form
        style={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          if (!loading) handleLogin();
        }}
      >
        <img src="/icono_2.png" alt="Kyntü" style={styles.logo} />
        <span style={styles.eyebrow}>Panel interno</span>
        <h1 style={styles.title}>Acceso administrador</h1>
        <p style={styles.subtitle}>Ingresa con tu cuenta master para gestionar la plataforma.</p>

        <label style={styles.label}>
          Correo electrónico
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
        </label>
        <label style={styles.label}>
          Contraseña
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />
        </label>
        {errorMessage && <p role="alert" style={styles.error}>{errorMessage}</p>}
        <div style={styles.actions}>
          <button type="submit" style={styles.button} disabled={loading}>{loading ? 'Ingresando...' : 'Ingresar'}</button>
          <button type="button" onClick={() => router.push('/')} style={styles.secondaryButton}>Volver</button>
        </div>
      </form>
    </main>
  );
}

const styles = {
  page: { minHeight: '100vh', minHeight: '100dvh', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden', padding: 24, background: 'linear-gradient(145deg, #f8fbff, #edf4ff 50%, #f8fcfb)' },
  glow: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 12% 18%, rgba(23,107,255,.16), transparent 32%), radial-gradient(circle at 88% 82%, rgba(0,194,168,.12), transparent 28%)' },
  card: { position: 'relative', width: 'min(460px, 100%)', padding: '36px 34px', border: '1px solid #e0e8f4', borderRadius: 28, background: 'rgba(255,255,255,.96)', boxShadow: '0 30px 80px rgba(20,55,120,.18)' },
  logo: { display: 'block', width: 76, height: 76, objectFit: 'contain', margin: '0 auto 10px' },
  eyebrow: { display: 'block', textAlign: 'center', color: '#176bff', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase' },
  title: { margin: '8px 0', textAlign: 'center', fontSize: 28, color: '#061b41' },
  subtitle: { margin: '0 0 26px', textAlign: 'center', color: '#60708a', fontSize: 14, lineHeight: 1.6 },
  label: { display: 'grid', gap: 8, marginTop: 15, color: '#253a5c', fontSize: 13, fontWeight: 700 },
  input: { width: '100%', padding: '13px 14px', borderRadius: 13, border: '1px solid #d7e1ef', outlineColor: '#176bff', color: '#061b41', background: '#fbfdff' },
  actions: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 22 },
  button: {
    background: 'linear-gradient(135deg, #176bff, #00afc8)',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '13px',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    border: '1px solid #d7e1ef',
    padding: '10px 16px',
    borderRadius: '13px',
    cursor: 'pointer',
    color: '#253a5c',
    fontWeight: 800,
  },
  error: {
    color: 'red',
    fontSize: '14px',
    margin: '14px 0 0',
    padding: '10px 12px',
    borderRadius: 10,
    background: '#fff1f2',
  },
};
