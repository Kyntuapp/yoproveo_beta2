import { useCallback, useEffect, useState } from 'react';
import { fetchEncuestaEstadoClient } from './fetchEncuestaEstadoClient';
import { fetchEncuestaPreguntasClient } from './fetchEncuestaPreguntasClient';
import { isForceEncuestaDev } from './isForceEncuestaDev';

export function useEncuestaEstado(tipoUsuario) {
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState(null);
  const [checkError, setCheckError] = useState(null);

  const loadEstado = useCallback(async () => {
    if (!tipoUsuario) {
      setVisible(false);
      setEstado(null);
      return;
    }

    setLoading(true);
    setCheckError(null);

    try {
      const data = await fetchEncuestaEstadoClient(tipoUsuario);

      if (data.requerida && Array.isArray(data.preguntas) && data.preguntas.length > 0) {
        setEstado(data);
        setVisible(true);
        return;
      }

      const forceDev = isForceEncuestaDev();

      if (
        forceDev &&
        data.motivo === 'cadencia_ok' &&
        data.tipo_usuario &&
        data.perfil_id
      ) {
        const preguntas = await fetchEncuestaPreguntasClient(data.tipo_usuario);

        if (preguntas.length > 0) {
          setEstado({
            ...data,
            preguntas,
            requerida: true,
            preview_dev: true,
          });
          setVisible(true);
          return;
        }
      }

      setEstado(data);
      setVisible(false);
    } catch (err) {
      console.error('useEncuestaEstado:', err);
      setCheckError(err.message || 'Error al verificar encuesta');
      setVisible(false);
      setEstado(null);
    } finally {
      setLoading(false);
    }
  }, [tipoUsuario]);

  useEffect(() => {
    loadEstado();
  }, [loadEstado]);

  const closeModal = useCallback(() => {
    setVisible(false);
    setEstado(null);
  }, []);

  return {
    loading,
    visible,
    estado,
    checkError,
    reload: loadEstado,
    closeModal,
  };
}
