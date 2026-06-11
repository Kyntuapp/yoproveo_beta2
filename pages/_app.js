// pages/_app.js
import '../styles/globals.css';
import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { validarSesion } from '../utils/sesions';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const actualizarActividad = () => {
      localStorage.setItem('last_activity', Date.now().toString());
    };

    window.addEventListener('click', actualizarActividad);
    window.addEventListener('keydown', actualizarActividad);
    window.addEventListener('mousemove', actualizarActividad);
    window.addEventListener('touchstart', actualizarActividad);

    return () => {
      window.removeEventListener('click', actualizarActividad);
      window.removeEventListener('keydown', actualizarActividad);
      window.removeEventListener('mousemove', actualizarActividad);
      window.removeEventListener('touchstart', actualizarActividad);
    };
  }, []);

  useEffect(() => {
    const rutasPublicas = ['/', '/login', '/register', '/reset-password'];

    if (rutasPublicas.includes(router.pathname)) return;

    validarSesion(supabase, router);

    const interval = setInterval(() => {
      validarSesion(supabase, router);
    }, 60000);

    return () => clearInterval(interval);
  }, [router]);

  return (
    <>
      <Head>
        <link rel="icon" href="/icono_2.png" sizes="any" type="image/png" />
      </Head>

      <Component {...pageProps} />
    </>
  );
}

export default MyApp;