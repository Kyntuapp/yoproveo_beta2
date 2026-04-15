import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useRouter } from 'next/router';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Entrando a recuperación de contraseña');
      }
    });
  }, []);

  const handleUpdatePassword = async () => {
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      alert('Error al actualizar contraseña: ' + error.message);
    } else {
      alert('Contraseña actualizada correctamente. Ahora puedes iniciar sesión.');
      router.push('/login');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Restablecer contraseña</h1>
      <input
        type="password"
        placeholder="Nueva contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
      />
      <button onClick={handleUpdatePassword} style={styles.button}>
        Guardar nueva contraseña
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
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    marginTop: '10px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
