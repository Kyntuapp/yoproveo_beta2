import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminSolicitudesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/master/solicitudes');
  }, [router]);

  return <div style={{ padding: 20 }}>Redirigiendo a solicitudes master...</div>;
}
