import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from './supabaseClient';

export async function verifyMasterProfile(user) {
  const { data: perfilPorAuth } = await supabase
    .from('perfiles')
    .select('tipo')
    .eq('auth_id', user.id)
    .eq('tipo', 'master')
    .maybeSingle();

  if (perfilPorAuth) {
    return true;
  }

  const email = user.email?.trim().toLowerCase();
  if (!email) {
    return false;
  }

  const { data: perfilPorEmail } = await supabase
    .from('perfiles')
    .select('tipo')
    .eq('email', email)
    .eq('tipo', 'master')
    .maybeSingle();

  return Boolean(perfilPorEmail);
}

export function useRequireMaster() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: userData, error } = await supabase.auth.getUser();

      if (error || !userData?.user) {
        router.replace('/admin-login');
        return;
      }

      const isMaster = await verifyMasterProfile(userData.user);

      if (!isMaster) {
        await supabase.auth.signOut();
        router.replace('/admin-login');
        return;
      }

      if (!cancelled) {
        setAuthorized(true);
        setLoading(false);
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return { authorized, loading };
}
