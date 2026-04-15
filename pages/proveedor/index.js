// pages/proveedor/index.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import Notificaciones from '../../components/Notificaciones'; // 🔔

export default function ProveedorIndex() {
  const [perfilId, setPerfilId] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: userData, error } = await supabase.auth.getUser();
      if (error || !userData?.user) {
        alert('Debes iniciar sesión.');
        router.push('/');
        return;
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('id')
        .eq('auth_id', userData.user.id)
        .eq('tipo', 'proveedor')
        .maybeSingle();

      if (perfilError || !perfil) {
        alert('No se encontró perfil de proveedor');
        router.push('/');
        return;
      }

      setPerfilId(perfil.id);
    };
    checkUser();
  }, [router]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    router.push('/login');
  };

  const cambiarPerfil = () => router.push('/seleccionar-perfil');
  const irCatalogo = () => router.push('/proveedor/catalogo');
  const irOfertarProductos = () => router.push('/proveedor/ofertar_productos');
  const irOfertasEnviadas = () => router.push('/proveedor/ofertas_enviadas');
  const irDatosContacto = () => router.push('/proveedor/datos-contacto');

  return (
    <div style={{ minHeight: '100vh', padding: 20, boxSizing: 'border-box' }}>
      {/* 🔔 Barra superior */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={cambiarPerfil}>Cambiar perfil</button>
          <button onClick={irDatosContacto}>Actualizar datos de contacto</button>
        </div>

        <h2>Panel del Proveedor</h2>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Notificaciones userId={perfilId} rol="proveedor" />
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      {/* Contenido centrado */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
      }}>
        <div style={{
          padding: 24,
          borderRadius: 12,
          border: '1px solid #ddd',
          boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
          minWidth: 260,
        }}>
          <h3 style={{ textAlign: 'center', marginTop: 0, marginBottom: 16 }}>
            Acciones rápidas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
            <button onClick={irCatalogo}>Catálogo y Stock</button>
            <button onClick={irOfertarProductos}>Ofertar Productos</button>
            <button onClick={irOfertasEnviadas}>Mis Ofertas Enviadas</button>
          </div>
        </div>
      </div>
    </div>
  );
}
