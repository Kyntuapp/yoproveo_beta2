import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function SeleccionarPerfil() {
  const router = useRouter();
  const [perfiles, setPerfiles] = useState([]);
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const emailGuardado = localStorage.getItem('user_email');
    if (!emailGuardado) {
      setErrorMessage('No se encontró información del usuario.');
      return;
    }

    setEmail(emailGuardado);

    const obtenerPerfiles = async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('tipo')
        .eq('email', emailGuardado);

      if (error || !data) {
        setErrorMessage('Error al obtener perfiles');
        return;
      }

      setPerfiles(data.map((perfil) => perfil.tipo));
    };

    obtenerPerfiles();
  }, []);

  const irAPerfil = (tipo) => {
    router.push(`/${tipo}`);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Selecciona tu perfil</h1>
      {errorMessage && <p style={styles.error}>{errorMessage}</p>}

      <div style={styles.buttonGroup}>
        {perfiles.includes('comprador') && (
          <button onClick={() => irAPerfil('comprador')} style={styles.button}>
            Ir a Comprador
          </button>
        )}
        {perfiles.includes('proveedor') && (
          <button onClick={() => irAPerfil('proveedor')} style={styles.button}>
            Ir a Proveedor
          </button>
        )}
      </div>

      <button onClick={() => router.push('/')} style={styles.secondaryButton}>
        Volver al inicio
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
  error: {
    color: 'red',
    fontSize: '14px',
    marginBottom: '20px',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '20px',
  },
  button: {
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  secondaryButton: {
    backgroundColor: '#ccc',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};
