import { useRouter } from 'next/router';
import { getEncuestaTipoFromPath } from '../../lib/encuesta/getEncuestaTipoFromPath';
import { useEncuestaEstado } from '../../lib/encuesta/useEncuestaEstado';
import EncuestaModal from './EncuestaModal';

export default function EncuestaGate() {
  const router = useRouter();
  const tipoUsuario = getEncuestaTipoFromPath(router.pathname);
  const { visible, estado, closeModal } = useEncuestaEstado(tipoUsuario);

  if (!tipoUsuario) {
    return null;
  }

  return (
    <EncuestaModal
      open={visible}
      estado={estado}
      onSuccess={closeModal}
    />
  );
}
