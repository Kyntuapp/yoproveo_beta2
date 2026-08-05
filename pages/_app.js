// pages/_app.js
import '../styles/globals.css';
import '../styles/landing.css';
import React, { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { validarSesion } from '../utils/sesions';
import EncuestaGate from '../components/encuesta/EncuestaGate';
import KyntuModal, { createModalState } from './KyntuModal';
import { subscribeToKyntuAlerts } from '../lib/kyntuAlert';
import {
  buildAceptarDocumentosPath,
  esRutaExentaGateLegal,
  esRutaPublica,
  sanitizeInternalNextPath,
  tieneAceptacionesLegalesVigentes,
} from '../utils/aceptacionesLegales';

function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const [accessReady, setAccessReady] = useState(false);
  const [kyntuModal, setKyntuModal] = useState(createModalState());
  const verificandoAccesoRef = useRef(false);

  const esRutaPublicaActual = esRutaPublica(router.pathname);
  const esRutaExentaLegal = esRutaExentaGateLegal(router.pathname);
  useEffect(
    () =>
      subscribeToKyntuAlerts(({ title, message, type }) => {
        const closeModal = () => setKyntuModal(createModalState());
        setKyntuModal({
          ...createModalState(),
          open: true,
          title,
          message,
          type,
          onConfirm: closeModal,
          onCancel: closeModal,
        });
      }),
    []
  );

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
    if (!router.isReady) return;

    if (esRutaPublicaActual) {
      setAccessReady(true);
      return;
    }

    let cancelled = false;

    const verificarAccesoInicial = async () => {
      if (verificandoAccesoRef.current) return;
      verificandoAccesoRef.current = true;
      setAccessReady(false);

      try {
        const sesionValida = await validarSesion(supabase, router);
        if (cancelled || !sesionValida) return;

        if (esRutaExentaLegal) {
          if (!cancelled) {
            setAccessReady(true);
          }
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user?.id) {
          await router.replace('/login');
          return;
        }

        const aceptaciones = await tieneAceptacionesLegalesVigentes(
          supabase,
          session.user.id
        );

        if (cancelled) return;

        if (!aceptaciones.ok) {
          await router.replace('/login');
          return;
        }

        if (!aceptaciones.vigentes) {
          const next = sanitizeInternalNextPath(
            router.asPath,
            '/seleccionar-perfil'
          );
          await router.replace(buildAceptarDocumentosPath(next));
          return;
        }

        setAccessReady(true);
      } finally {
        verificandoAccesoRef.current = false;
      }
    };

    const revalidarSesionEnSegundoPlano = async () => {
      if (cancelled || verificandoAccesoRef.current) return;
      await validarSesion(supabase, router);
    };

    verificarAccesoInicial();

    const interval = setInterval(revalidarSesionEnSegundoPlano, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    router.isReady,
    router.pathname,
    esRutaPublicaActual,
    esRutaExentaLegal,
  ]);

  const mostrarContenido = esRutaPublicaActual || accessReady;

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

      {mostrarContenido ? <Component {...pageProps} /> : null}

      {mostrarContenido && !esRutaPublicaActual && <EncuestaGate />}
      <KyntuModal {...kyntuModal} />
    </>
  );
}

export default MyApp;
