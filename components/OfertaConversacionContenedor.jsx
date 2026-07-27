import { useCallback, useEffect, useRef, useState } from 'react';
import OfertaAccionesBar from './OfertaAccionesBar';
import OfertaConversacion from './OfertaConversacion';
import {
  contarMensajesNoLeidos,
  panelConversacionId,
  subscribeMensajesOferta,
} from '../lib/ofertaMensajes';

export default function OfertaConversacionContenedor({
  ofertaId,
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
  participanteLabel = 'Contraparte',
}) {
  const [chatAbiertoInterno, setChatAbiertoInterno] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const autoAbiertoRef = useRef(false);

  const chatAbierto =
    typeof chatAbiertoControlado === 'boolean'
      ? chatAbiertoControlado
      : chatAbiertoInterno;

  const panelId = panelConversacionId(ofertaId);

  const actualizarContador = useCallback(async () => {
    if (!ofertaId || !authUserId) return;
    const total = await contarMensajesNoLeidos(ofertaId, authUserId);
    setNoLeidos(total);
  }, [authUserId, ofertaId]);

  useEffect(() => {
    if (autoAbrirChat && !autoAbiertoRef.current) {
      autoAbiertoRef.current = true;
      if (typeof chatAbiertoControlado !== 'boolean') {
        setChatAbiertoInterno(true);
      }
    }
  }, [autoAbrirChat, chatAbiertoControlado, ofertaId]);

  useEffect(() => {
    if (!ofertaId || !authUserId || chatAbierto) return;
    actualizarContador();
  }, [actualizarContador, authUserId, chatAbierto, ofertaId]);

  useEffect(() => {
    if (!ofertaId || !authUserId || chatAbierto) return undefined;

    return subscribeMensajesOferta(ofertaId, () => {
      actualizarContador();
    });
  }, [actualizarContador, authUserId, chatAbierto, ofertaId]);

  const handleToggleChat = (event) => {
    event.stopPropagation();

    if (onToggleChat) {
      onToggleChat(ofertaId);
      return;
    }

    setChatAbiertoInterno((prev) => !prev);
  };

  const handleLeidosActualizados = useCallback((_ofertaId) => {
    setNoLeidos((prev) => (prev === 0 ? prev : 0));
  }, []);

  return (
    <div style={styles.root}>
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

      {chatAbierto && !mostrarSoloBarra && (
        <OfertaConversacion
          ofertaId={ofertaId}
          authUserId={authUserId}
          estadoOferta={estadoOferta}
          variant={variant}
          panelId={panelId}
          onLeidosActualizados={handleLeidosActualizados}
          participanteLabel={participanteLabel}
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
};
