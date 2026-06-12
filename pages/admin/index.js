import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/master');
  }, [router]);

  return <div style={{ padding: 32 }}>Redirigiendo al panel master...</div>;
}
