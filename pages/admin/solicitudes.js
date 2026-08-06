import { useEffect } from 'react';
import { useRouter } from 'next/router';
import KyntuStatusPage from '../../components/KyntuStatusPage';

export default function AdminSolicitudesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/master/solicitudes');
  }, [router]);

  return <KyntuStatusPage title="Abriendo solicitudes" message="Cargando la gestión de productos." />;
}
