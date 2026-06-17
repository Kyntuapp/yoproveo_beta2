import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isComprador, setIsComprador] = useState(false);
  const [isProveedor, setIsProveedor] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setErrorMessage('');
    setLoading(true);

    try {
      if (!email || !password || (!isComprador && !isProveedor)) {
        setErrorMessage('Completa todos los campos y selecciona al menos un perfil.');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const { data: perfilesExistentes } = await supabase
        .from('perfiles')
        .select('auth_id, tipo')
        .eq('email', normalizedEmail);

      const authIdExistente =
        perfilesExistentes?.find((p) => p.auth_id)?.auth_id ?? null;

      const tiposExistentes = new Set(
        (perfilesExistentes || []).map((p) => p.tipo)
      );

      const quiereCompradorNuevo =
        isComprador && !tiposExistentes.has('comprador');
      const quiereProveedorNuevo =
        isProveedor && !tiposExistentes.has('proveedor');

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      let authIdParaInsert = authIdExistente;

      if (error) {
        const isAlready = error.message.toLowerCase().includes('already');

        if (isAlready && (quiereCompradorNuevo || quiereProveedorNuevo)) {
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });

          if (signInError || !signInData?.user) {
            setErrorMessage(
              'Este correo ya tiene una cuenta. Verifica tu contraseña para agregar el perfil.'
            );
            setLoading(false);
            return;
          }

          authIdParaInsert = authIdExistente ?? signInData.user.id;
        } else if (isAlready) {
          setErrorMessage('Este correo ya tiene una cuenta registrada.');
          setLoading(false);
          return;
        } else {
          setErrorMessage('Error al crear usuario: ' + error.message);
          setLoading(false);
          return;
        }
      } else {
        const user = data?.user;

        if (!user && !authIdExistente) {
          setErrorMessage('No se pudo crear el usuario en Auth.');
          setLoading(false);
          return;
        }

        if (authIdExistente) {
          authIdParaInsert = authIdExistente;
        } else if (user?.identities?.length > 0) {
          authIdParaInsert = user.id;
        } else if (user) {
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });

          if (signInError || !signInData?.user) {
            setErrorMessage(
              'No se pudo verificar la cuenta. Inicia sesión e intenta nuevamente.'
            );
            setLoading(false);
            return;
          }

          authIdParaInsert = signInData.user.id;
        }
      }

      if (!authIdParaInsert) {
        setErrorMessage('No se pudo obtener el usuario en Auth.');
        setLoading(false);
        return;
      }

      if (!quiereCompradorNuevo && !quiereProveedorNuevo) {
        setErrorMessage('Este usuario ya tiene los perfiles seleccionados.');
        setLoading(false);
        return;
      }

      const perfilesToInsert = [];

      if (quiereCompradorNuevo) {
        const { data: existente } = await supabase
          .from('perfiles')
          .select('id')
          .eq('email', normalizedEmail)
          .eq('tipo', 'comprador')
          .maybeSingle();

        if (existente) {
          setErrorMessage(
            'Según nuestros registros este usuario ya tiene creado el perfil de comprador.'
          );
          setLoading(false);
          return;
        }

        perfilesToInsert.push({
          email: normalizedEmail,
          tipo: 'comprador',
          auth_id: authIdParaInsert,
        });
      }

      if (quiereProveedorNuevo) {
        const { data: existente } = await supabase
          .from('perfiles')
          .select('id')
          .eq('email', normalizedEmail)
          .eq('tipo', 'proveedor')
          .maybeSingle();

        if (existente) {
          setErrorMessage(
            'Según nuestros registros este usuario ya tiene creado el perfil de proveedor.'
          );
          setLoading(false);
          return;
        }

        perfilesToInsert.push({
          email: normalizedEmail,
          tipo: 'proveedor',
          auth_id: authIdParaInsert,
        });
      }

      if (perfilesToInsert.length > 0) {
        const { error: perfilError } = await supabase
          .from('perfiles')
          .insert(perfilesToInsert);

        if (perfilError) {
          if (perfilError.message.toLowerCase().includes('duplicate')) {
            setErrorMessage(
              'Según nuestros registros este usuario ya tiene creado este perfil.'
            );
          } else {
            setErrorMessage('Error al registrar el perfil: ' + perfilError.message);
          }
          setLoading(false);
          return;
        }
      }

      alert(
        authIdExistente
          ? 'Perfil agregado correctamente.'
          : 'Usuario registrado con éxito. Revisa tu correo para confirmar la cuenta.'
      );
      router.push('/login');
    } catch (err) {
      console.error(err);
      setErrorMessage('Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Registro</h1>

      <input
        type="email"
        placeholder="Correo"
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

      <div style={styles.checkboxContainer}>
        <label>
          <input
            type="checkbox"
            checked={isComprador}
            onChange={(e) => setIsComprador(e.target.checked)}
          />{' '}
          Soy Comprador
        </label>
        <label style={{ marginLeft: '20px' }}>
          <input
            type="checkbox"
            checked={isProveedor}
            onChange={(e) => setIsProveedor(e.target.checked)}
          />{' '}
          Soy Proveedor
        </label>
      </div>

      {errorMessage && <p style={styles.error}>{errorMessage}</p>}

      <div style={styles.buttonGroup}>
        <button onClick={handleRegister} style={styles.button} disabled={loading}>
          {loading ? 'Registrando...' : 'Registrarse'}
        </button>
        <button onClick={() => router.push('/')} style={styles.secondaryButton}>
          Volver
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: { textAlign: 'center', paddingTop: '80px' },
  title: { fontSize: '24px', marginBottom: '20px' },
  input: {
    display: 'block',
    margin: '10px auto',
    padding: '10px',
    width: '250px',
    borderRadius: '5px',
    border: '1px solid #ccc',
  },
  checkboxContainer: { display: 'flex', justifyContent: 'center', margin: '10px 0' },
  error: { color: 'red', fontSize: '14px', margin: '10px 0' },
  buttonGroup: { marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px' },
  button: {
    backgroundColor: '#0070f3',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: '#ccc',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '8px',
    cursor: 'pointer',
  },
};
