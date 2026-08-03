import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import OfertaAccionesBar from './OfertaAccionesBar';
import OfertaConversacion from './OfertaConversacion';
import {
  contarMensajesNoLeidos,
  contarMensajesNoLeidosConversacion,
  esErrorChatPreOfertaNoDisponible,
  mensajeErrorChatPreOferta,
  obtenerConversacionPorOferta,
  obtenerConversacionProveedorSolicitud,
  panelConversacionId,
  panelConversacionIdPorConversacion,
  registrarErrorConversacion,
  subscribeMensajesConversacion,
  subscribeMensajesOferta,
} from '../lib/ofertaMensajes';

function panelConversacionIdPorSolicitud(listasComprasId) {
  return `solicitud-conversacion-panel-${listasComprasId}`;
}

/**
 * @param {{ ofertaId?: string, listasComprasId?: string, conversacionId?: string }} props
 * @returns {'oferta'|'solicitud'|'conversacion'|'invalid'|null}
 */
function resolverModoContenedor({
  ofertaId,
  listasComprasId,
  conversacionId,
}) {
  const ids = [ofertaId, listasComprasId, conversacionId].filter(Boolean);

  if (ids.length > 1) {
    registrarErrorConversacion(
      'contenedor-modo',
      new Error(
        'ofertaId, listasComprasId y conversacionId son mutuamente excluyentes'
      )
    );
    return 'invalid';
  }

  if (conversacionId) return 'conversacion';
  if (ofertaId) return 'oferta';
  if (listasComprasId) return 'solicitud';
  return null;
}

export default function OfertaConversacionContenedor({
  ofertaId,
  listasComprasId,
  conversacionId: conversacionIdProp,
  authUserId,
  estadoOferta,
  tooltipChat = 'Hablar con el proveedor',
  mostrarAceptarRechazar = false,
  onAceptar,
  onRechazar,
  autoAbrirChat = false,
  chatAbierto: chatAbiertoControlado,
  onToggleChat,
  mostrarSoloBarra = false,
  variant = 'dark',
  ocultarBarra = false,
  onLeidosActualizados,
  onConversacionDetectada,
  participanteLabel = 'Contraparte',
  soloLectura = false,
  mensajeCierre = '',
}) {
  const [chatAbiertoInterno, setChatAbiertoInterno] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const [conversacionId, setConversacionId] = useState(null);
  const [conversacionVinculadaId, setConversacionVinculadaId] =
    useState(null);
  const [resolviendoConversacion, setResolviendoConversacion] =
    useState(false);
  const [resolviendoOferta, setResolviendoOferta] = useState(false);
  const [errorResolucion, setErrorResolucion] = useState('');

  const autoAbiertoRef = useRef(false);
  const resolveGenRef = useRef(0);
  const resolveOfertaGenRef = useRef(0);
  const contadorGenRef = useRef(0);
  const solicitudActivaRef = useRef(listasComprasId);

  const modoContenedor = useMemo(
    () =>
      resolverModoContenedor({
        ofertaId,
        listasComprasId,
        conversacionId: conversacionIdProp,
      }),
    [conversacionIdProp, listasComprasId, ofertaId]
  );

  const chatAbierto =
    typeof chatAbiertoControlado === 'boolean'
      ? chatAbiertoControlado
      : chatAbiertoInterno;

  const toggleKey = ofertaId || listasComprasId || conversacionIdProp;

  const conversacionIdActivo = useMemo(() => {
    if (modoContenedor === 'conversacion') {
      return conversacionIdProp;
    }

    if (modoContenedor === 'oferta' && conversacionVinculadaId) {
      return conversacionVinculadaId;
    }

    if (modoContenedor === 'solicitud' && conversacionId) {
      return conversacionId;
    }

    return null;
  }, [
    conversacionId,
    conversacionIdProp,
    conversacionVinculadaId,
    modoContenedor,
  ]);

  const modoChatOperacional = useMemo(() => {
    if (modoContenedor === 'conversacion') return 'conversacion';

    if (modoContenedor === 'oferta') {
      if (resolviendoOferta) return null;
      if (conversacionVinculadaId) return 'conversacion';
      return 'oferta';
    }

    if (modoContenedor === 'solicitud') {
      if (resolviendoConversacion) return null;
      if (conversacionId) return 'conversacion';
      return 'solicitud';
    }

    return null;
  }, [
    conversacionId,
    conversacionVinculadaId,
    modoContenedor,
    resolviendoConversacion,
    resolviendoOferta,
  ]);

  const panelId = useMemo(() => {
    if (conversacionIdActivo) {
      return panelConversacionIdPorConversacion(conversacionIdActivo);
    }

    if (modoContenedor === 'oferta') {
      return panelConversacionId(ofertaId);
    }

    return panelConversacionIdPorSolicitud(listasComprasId);
  }, [
    conversacionIdActivo,
    listasComprasId,
    modoContenedor,
    ofertaId,
  ]);

  const conversacionKey = useMemo(() => {
    if (modoContenedor === 'conversacion') {
      return `conversacion-${conversacionIdProp}`;
    }

    if (modoContenedor === 'oferta') {
      return conversacionVinculadaId
        ? `conversacion-${conversacionVinculadaId}`
        : `oferta-${ofertaId}`;
    }

    if (modoContenedor === 'solicitud') {
      return conversacionId
        ? `conversacion-${conversacionId}`
        : `solicitud-${listasComprasId}`;
    }

    return 'invalid';
  }, [
    conversacionId,
    conversacionIdProp,
    conversacionVinculadaId,
    listasComprasId,
    modoContenedor,
    ofertaId,
  ]);

  useEffect(() => {
    if (modoContenedor !== 'oferta' || !ofertaId) {
      resolveOfertaGenRef.current += 1;
      setConversacionVinculadaId(null);
      setResolviendoOferta(false);
      return;
    }

    const gen = ++resolveOfertaGenRef.current;
    setResolviendoOferta(true);

    (async () => {
      try {
        const conversacion = await obtenerConversacionPorOferta(ofertaId);

        if (gen !== resolveOfertaGenRef.current) return;

        setConversacionVinculadaId(conversacion?.id ?? null);
      } catch (err) {
        if (gen !== resolveOfertaGenRef.current) return;

        registrarErrorConversacion('resolver-oferta', err);
        setConversacionVinculadaId(null);
      } finally {
        if (gen === resolveOfertaGenRef.current) {
          setResolviendoOferta(false);
        }
      }
    })();
  }, [modoContenedor, ofertaId]);

  useEffect(() => {
    if (modoContenedor !== 'solicitud' || !listasComprasId) {
      resolveGenRef.current += 1;
      setConversacionId(null);
      setResolviendoConversacion(false);
      setErrorResolucion('');
      return;
    }

    if (solicitudActivaRef.current !== listasComprasId) {
      solicitudActivaRef.current = listasComprasId;
      setConversacionId(null);
      setErrorResolucion('');
      contadorGenRef.current += 1;
    }

    const gen = ++resolveGenRef.current;
    setResolviendoConversacion(true);

    (async () => {
      try {
        const conversacion =
          await obtenerConversacionProveedorSolicitud(listasComprasId);

        if (gen !== resolveGenRef.current) return;

        setConversacionId(conversacion?.id ?? null);
        setErrorResolucion('');
      } catch (err) {
        if (gen !== resolveGenRef.current) return;

        registrarErrorConversacion('resolver-solicitud', err);

        setConversacionId(null);

        if (esErrorChatPreOfertaNoDisponible(err)) {
          setErrorResolucion(
            mensajeErrorChatPreOferta(err, { contexto: 'carga' })
          );
        } else {
          setErrorResolucion('');
        }
      } finally {
        if (gen === resolveGenRef.current) {
          setResolviendoConversacion(false);
        }
      }
    })();
  }, [listasComprasId, modoContenedor]);

  useEffect(() => {
    if (modoContenedor !== 'solicitud' || !listasComprasId) return;
    if (resolviendoConversacion) return;

    onConversacionDetectada?.(listasComprasId, conversacionId);
  }, [
    conversacionId,
    listasComprasId,
    modoContenedor,
    onConversacionDetectada,
    resolviendoConversacion,
  ]);

  const actualizarContadorLegacy = useCallback(async () => {
    if (!ofertaId || !authUserId) return;

    const gen = ++contadorGenRef.current;
    const total = await contarMensajesNoLeidos(ofertaId, authUserId);

    if (gen !== contadorGenRef.current) return;
    setNoLeidos(total);
  }, [authUserId, ofertaId]);

  const actualizarContadorConversacion = useCallback(async () => {
    if (!conversacionIdActivo) {
      setNoLeidos(0);
      return;
    }

    const gen = ++contadorGenRef.current;

    try {
      const total =
        await contarMensajesNoLeidosConversacion(conversacionIdActivo);

      if (gen !== contadorGenRef.current) return;
      setNoLeidos(total);
    } catch (err) {
      if (gen !== contadorGenRef.current) return;

      registrarErrorConversacion('contador-conversacion', err);
      setNoLeidos(0);
    }
  }, [conversacionIdActivo]);

  useEffect(() => {
    if (autoAbrirChat && !autoAbiertoRef.current) {
      autoAbiertoRef.current = true;
      if (typeof chatAbiertoControlado !== 'boolean') {
        setChatAbiertoInterno(true);
      }
    }
  }, [autoAbrirChat, chatAbiertoControlado, toggleKey]);

  useEffect(() => {
    if (!authUserId || chatAbierto) return;

    if (modoContenedor === 'oferta' && !conversacionIdActivo) {
      actualizarContadorLegacy();
      return;
    }

    if (conversacionIdActivo) {
      actualizarContadorConversacion();
      return;
    }

    if (modoContenedor === 'solicitud') {
      setNoLeidos(0);
    }
  }, [
    actualizarContadorConversacion,
    actualizarContadorLegacy,
    authUserId,
    chatAbierto,
    conversacionIdActivo,
    modoContenedor,
    toggleKey,
  ]);

  useEffect(() => {
    if (!authUserId || chatAbierto) return undefined;

    if (modoContenedor === 'oferta' && ofertaId && !conversacionIdActivo) {
      return subscribeMensajesOferta(ofertaId, () => {
        actualizarContadorLegacy();
      });
    }

    if (conversacionIdActivo) {
      return subscribeMensajesConversacion(conversacionIdActivo, () => {
        actualizarContadorConversacion();
      });
    }

    return undefined;
  }, [
    actualizarContadorConversacion,
    actualizarContadorLegacy,
    authUserId,
    chatAbierto,
    conversacionIdActivo,
    modoContenedor,
    ofertaId,
  ]);

  const handleToggleChat = (event) => {
    event.stopPropagation();

    if (onToggleChat) {
      onToggleChat(toggleKey);
      return;
    }

    setChatAbiertoInterno((prev) => !prev);
  };

  const handleLeidosActualizados = useCallback(() => {
    setNoLeidos((prev) => (prev === 0 ? prev : 0));
    onLeidosActualizados?.();
  }, [onLeidosActualizados]);

  const handleConversacionCreada = useCallback((nuevoConversacionId) => {
    if (!nuevoConversacionId) return;
    setConversacionId(nuevoConversacionId);
    setErrorResolucion('');
  }, []);

  if (!modoContenedor || modoContenedor === 'invalid' || !authUserId) {
    return null;
  }

  const propsOperacionales =
    modoChatOperacional === 'oferta'
      ? { modoChat: 'oferta', ofertaId }
      : modoChatOperacional === 'conversacion'
        ? { modoChat: 'conversacion', conversacionId: conversacionIdActivo }
        : modoChatOperacional === 'solicitud'
          ? { modoChat: 'solicitud', listasComprasId }
          : null;

  const resolviendo =
    resolviendoConversacion || resolviendoOferta;

  return (
    <div style={styles.root}>
      {!ocultarBarra && (
        <OfertaAccionesBar
          tooltipChat={tooltipChat}
          noLeidos={noLeidos}
          chatAbierto={chatAbierto}
          panelId={panelId}
          onToggleChat={handleToggleChat}
          onAceptar={onAceptar}
          onRechazar={onRechazar}
          mostrarAceptarRechazar={mostrarAceptarRechazar}
          variant={variant}
        />
      )}

      {chatAbierto && !mostrarSoloBarra && resolviendo && (
        <p
          style={{
            ...styles.estadoResolucion,
            color:
              variant === 'light'
                ? '#748399'
                : 'rgba(255,255,255,0.55)',
          }}
        >
          Cargando conversación…
        </p>
      )}

      {chatAbierto &&
        !mostrarSoloBarra &&
        !resolviendo &&
        errorResolucion && (
          <p style={styles.errorResolucion}>{errorResolucion}</p>
        )}

      {chatAbierto &&
        !mostrarSoloBarra &&
        propsOperacionales &&
        !errorResolucion && (
          <OfertaConversacion
            key={conversacionKey}
            authUserId={authUserId}
            estadoOferta={estadoOferta}
            variant={variant}
            panelId={panelId}
            onLeidosActualizados={handleLeidosActualizados}
            onConversacionCreada={handleConversacionCreada}
            participanteLabel={participanteLabel}
            soloLectura={soloLectura}
            mensajeCierre={mensajeCierre}
            {...propsOperacionales}
          />
        )}
    </div>
  );
}

const styles = {
  root: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
  },
  estadoResolucion: {
    margin: '8px 0 0',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '12px',
    fontStyle: 'italic',
  },
  errorResolucion: {
    margin: '8px 0 0',
    color: '#ff8fa3',
    fontSize: '11px',
  },
};
