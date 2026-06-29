import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { Eye, EyeOff } from "lucide-react";

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isComprador, setIsComprador] = useState(false);
  const [isProveedor, setIsProveedor] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      <div style={styles.card}>
        <img
  src="/icono_1.png"
  alt="Kyntü"
  style={styles.logo}
/>

<h1 style={styles.title}>Registro</h1>

      <input
        type="email"
        placeholder="Correo"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={styles.input}
      />
   <div style={styles.passwordContainer}>
  <input
    type={showPassword ? "text" : "password"}
    placeholder="Contraseña"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    style={styles.passwordInput}
  />

  <button
    type="button"
    onClick={() => setShowPassword((v) => !v)}
    style={styles.eyeButton}
  >
    {showPassword ? (
      <EyeOff size={20} strokeWidth={2} />
    ) : (
      <Eye size={20} strokeWidth={2} />
    )}
  </button>
</div>

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
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: '#f7f9fc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    color: '#061b41',
  },
  title: {
    fontSize: '34px',
    fontWeight: 900,
    marginBottom: '28px',
    color: '#061b41',
  },
  input: {
    display: 'block',
    width: '100%',
    maxWidth: '340px',
    margin: '10px auto',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    color: '#061b41',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  checkboxContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '22px',
    margin: '18px 0 12px',
    color: '#061b41',
    fontWeight: 700,
  },
  error: {
    color: '#ef4444',
    fontSize: '14px',
    fontWeight: 700,
    margin: '12px 0',
    textAlign: 'center',
  },
  buttonGroup: {
    marginTop: '18px',
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
  },
  button: {
    background: '#176BFF',
    color: '#fff',
    border: 'none',
    padding: '13px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 900,
    boxShadow: '0 14px 28px rgba(23,107,255,0.24)',
  },
  secondaryButton: {
    background: '#e5e7eb',
    color: '#061b41',
    border: 'none',
    padding: '13px 24px',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 900,
  },
  card: {
  width: '100%',
  maxWidth: '430px',
  background: '#ffffff',
  border: '1px solid #e5ebf5',
  borderRadius: '28px',
  padding: '38px 34px',
  boxShadow: '0 30px 90px rgba(20, 55, 120, 0.12)',
  textAlign: 'center',
},
logo: {
  width: '270px',
  display: 'block',
  margin: '-49px auto -75px',
},
passwordContainer: {
  position: 'relative',
  width: '100%',
  maxWidth: '340px',
  margin: '10px auto',
},

passwordInput: {
  width: '100%',
  padding: '14px 48px 14px 16px',
  borderRadius: '12px',
  border: '1px solid #dbe4f0',
  background: '#fff',
  color: '#061b41',
  fontSize: '15px',
  boxSizing: 'border-box',
},

eyeButton: {
  position: 'absolute',
  top: '50%',
  right: '14px',
  transform: 'translateY(-50%)',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: '#6b7280',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
},
};
