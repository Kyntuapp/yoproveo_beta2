import { useEffect, useMemo, useState } from 'react';
import { submitEncuestaClient } from '../../lib/encuesta/submitEncuestaClient';

const LIKERT_OPTIONS = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

const ERROR_MESSAGES = {
  cadencia_no_cumplida:
    'Ya registraste una respuesta recientemente. Debes esperar 7 días para volver a responder.',
  encuesta_desactivada: 'La encuesta no está activa en este momento.',
  perfil_invalido: 'Tu perfil no puede responder esta encuesta.',
};

function mapSubmitError(message) {
  return ERROR_MESSAGES[message] || message || 'No se pudo enviar la encuesta.';
}

export default function EncuestaModal({ open, estado, onSuccess }) {
  const preguntas = estado?.preguntas || [];
  const tipoUsuario = estado?.tipo_usuario;

  const likertPreguntas = useMemo(
    () => preguntas.filter((p) => p.tipo_respuesta === 'escala_1_4'),
    [preguntas]
  );

  const preguntaAbierta = useMemo(
    () => preguntas.find((p) => p.tipo_respuesta === 'texto_abierto') || null,
    [preguntas]
  );

  const [respuestas, setRespuestas] = useState({});
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!open) {
      setRespuestas({});
      setComentario('');
      setSubmitting(false);
      setSubmitError('');
    }
  }, [open, estado?.perfil_id]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !estado) return null;

  const allLikertAnswered = likertPreguntas.every(
    (p) => respuestas[p.codigo] >= 1 && respuestas[p.codigo] <= 4
  );

  const handleLikertChange = (codigo, valor) => {
    setRespuestas((prev) => ({ ...prev, [codigo]: valor }));
    setSubmitError('');
  };

  const handleSubmit = async () => {
    if (!allLikertAnswered || submitting) return;

    setSubmitting(true);
    setSubmitError('');

    try {
      const payloadRespuestas = likertPreguntas.map((p) => ({
        pregunta_codigo: p.codigo,
        valor: respuestas[p.codigo],
      }));

      await submitEncuestaClient({
        tipoUsuario,
        respuestas: payloadRespuestas,
        comentarioAbierto: comentario.trim() || null,
      });

      onSuccess?.();
    } catch (err) {
      setSubmitError(mapSubmitError(err.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="encuesta-title">
      <div style={styles.modal}>
        <img src="/icono_1.png" alt="" style={styles.backgroundLogo} />

        <h2 id="encuesta-title" style={styles.title}>
          Encuesta semanal Kyntü
        </h2>

        <p style={styles.subtitle}>
          Tu opinión nos ayuda a mejorar la experiencia del piloto. Todas las preguntas
          cerradas son obligatorias (escala 1 a 4).
        </p>

        {estado.preview_dev && (
          <p style={styles.devBanner}>Modo prueba local activo (solo desarrollo)</p>
        )}

        <div style={styles.questions}>
          {likertPreguntas.map((pregunta, index) => (
            <div key={pregunta.codigo} style={styles.questionBlock}>
              <p style={styles.questionText}>
                {index + 1}. {pregunta.texto}
              </p>
              <div style={styles.likertRow}>
                {LIKERT_OPTIONS.map((opt) => {
                  const selected = respuestas[pregunta.codigo] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleLikertChange(pregunta.codigo, opt.value)}
                      style={{
                        ...styles.likertButton,
                        ...(selected ? styles.likertButtonSelected : {}),
                      }}
                      aria-pressed={selected}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {preguntaAbierta && (
            <div style={styles.questionBlock}>
              <p style={styles.questionText}>{preguntaAbierta.texto}</p>
              <textarea
                value={comentario}
                disabled={submitting}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Opcional"
                maxLength={2000}
                rows={4}
                style={styles.textarea}
              />
            </div>
          )}
        </div>

        {submitError && <p style={styles.error}>{submitError}</p>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allLikertAnswered || submitting}
          style={{
            ...styles.submitButton,
            ...(!allLikertAnswered || submitting ? styles.submitButtonDisabled : {}),
          }}
        >
          {submitting ? 'Enviando…' : 'Enviar respuestas'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(7, 18, 40, 0.55)',
    backdropFilter: 'blur(8px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    maxWidth: '640px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    border: '1px solid #e5ebf5',
    borderRadius: '28px',
    padding: '28px 28px 24px',
    boxShadow: '0 30px 90px rgba(20, 55, 120, 0.22)',
    fontFamily: '"Plus Jakarta Sans", Arial, Helvetica, sans-serif',
  },
  backgroundLogo: {
    position: 'absolute',
    width: '230px',
    opacity: 0.05,
    right: '-35px',
    top: '-10px',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  title: {
    position: 'relative',
    zIndex: 2,
    color: '#061b41',
    fontSize: '24px',
    fontWeight: 800,
    margin: '0 0 8px',
  },
  subtitle: {
    position: 'relative',
    zIndex: 2,
    color: '#52627a',
    fontSize: '14px',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  devBanner: {
    position: 'relative',
    zIndex: 2,
    margin: '0 0 12px',
    padding: '8px 12px',
    borderRadius: '10px',
    background: '#fff7ed',
    color: '#9a3412',
    fontSize: '13px',
    fontWeight: 600,
  },
  questions: {
    position: 'relative',
    zIndex: 2,
    overflowY: 'auto',
    flex: 1,
    paddingRight: '4px',
    marginBottom: '16px',
  },
  questionBlock: {
    marginBottom: '18px',
  },
  questionText: {
    color: '#061b41',
    fontSize: '15px',
    lineHeight: 1.5,
    margin: '0 0 10px',
    fontWeight: 600,
  },
  likertRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  likertButton: {
    minWidth: '52px',
    height: '44px',
    borderRadius: '12px',
    border: '1px solid #dbe4f0',
    background: '#ffffff',
    color: '#061b41',
    fontWeight: 700,
    fontSize: '16px',
    cursor: 'pointer',
  },
  likertButtonSelected: {
    border: '2px solid #176BFF',
    background: '#eef4ff',
    color: '#176BFF',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '12px',
    border: '1px solid #dbe4f0',
    padding: '12px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  error: {
    position: 'relative',
    zIndex: 2,
    color: '#b91c1c',
    fontSize: '14px',
    margin: '0 0 12px',
    lineHeight: 1.4,
  },
  submitButton: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    border: 'none',
    borderRadius: '14px',
    padding: '14px 20px',
    background: '#176BFF',
    color: '#ffffff',
    fontWeight: 800,
    fontSize: '16px',
    cursor: 'pointer',
    boxShadow: '0 14px 28px rgba(23, 107, 255, 0.25)',
  },
  submitButtonDisabled: {
    background: '#94a3b8',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};
