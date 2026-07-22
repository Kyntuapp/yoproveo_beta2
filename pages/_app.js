// pages/_app.js
import '../styles/globals.css';
import '../styles/landing.css';
import React, { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { validarSesion } from '../utils/sesions';
import EncuestaGate from '../components/encuesta/EncuestaGate';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  const rutasPublicas = [
    '/',
    '/login',
    '/register',
    '/reset-password',
    '/terminos',
    '/privacidad',
  ];

  const esRutaPublica = rutasPublicas.includes(router.pathname);

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
    if (esRutaPublica) return;

    validarSesion(supabase, router);

    const interval = setInterval(() => {
      validarSesion(supabase, router);
    }, 60000);

    return () => clearInterval(interval);
  }, [esRutaPublica, router]);

  return (
    <>
      <Head>
        <link rel="icon" href="/icono_2.png" sizes="any" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </Head>

      <Component {...pageProps} />

      {!esRutaPublica && <EncuestaGate />}
    </>
  );
}

export default MyApp;

