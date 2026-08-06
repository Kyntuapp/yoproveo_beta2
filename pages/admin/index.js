import { useEffect } from 'react';
import { useRouter } from 'next/router';
import KyntuStatusPage from '../../components/KyntuStatusPage';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/master');
  }, [router]);

  return <KyntuStatusPage title="Abriendo panel master" message="Estamos preparando tu espacio de administración." />;
}
