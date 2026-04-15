import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    setErrorMessage('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setErrorMessage('Credenciales incorrectas');
      return;
    }

    // Consultar perfil y verificar si es "master"
    const { data: perfiles, error: perfilesError } = await supabase
      .from('perfiles')
      .select('tipo')
      .eq('email', email);

    if (perfilesError || !perfiles || perfiles.length === 0) {
      setErrorMessage('No se encontró perfil asociado');
      return;
    }

    const perfil = perfiles[0];
    if (perfil.tipo !== 'master') {
      setErrorMessage('No tienes permiso para acceder al panel administrador');
      return;
    }

    router.push('/master');
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Acceso Administrador</h1>
      <input
        type="email"
        placeholder="Correo electrónico"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={styles.input}
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
      />
      {errorMessage && <p style={styles.error}>{errorMessage}</p>}
      <button onClick={handleLogin} style={styles.button}>
        Ingresar
      </button>
      <button onClick={() => router.push('/')} style={styles.secondaryButton}>
        Volver
      </button>
    </div>
  );
}

const styles = {
  container: {
    textAlign: 'center',
    paddingTop: '80px',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
  },
  input: {
    display: 'block',
    margin: '10px auto',
    padding: '10px',
    width: '250px',
    borderRadius: '5px',
    border: '1px solid #ccc',
  },
  button: {
    backgroundColor: '#333',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    marginTop: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryButton: {
    marginTop: '10px',
    backgroundColor: '#ccc',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    marginLeft: '10px',
  },
  error: {
    color: 'red',
    fontSize: '14px',
    marginTop: '10px',
  },
};
