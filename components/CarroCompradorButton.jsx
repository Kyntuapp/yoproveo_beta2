import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ShoppingCart } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  CARRO_UPDATED_EVENT,
  fetchCarroOfertasComprador,
} from '../lib/carroComprador';

export default function CarroCompradorButton() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [authUserId, setAuthUserId] = useState(null);

  const refreshCount = useCallback(async (userId) => {
    const uid = userId || authUserId;
    if (!uid) {
      setCount(0);
      return;
    }

    const { count: nextCount, error } =
      await fetchCarroOfertasComprador(uid);

    if (error) {
      console.error('Error cargando badge del carro:', error.message);
      return;
    }

    setCount(nextCount || 0);
  }, [authUserId]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      setAuthUserId(user.id);
      await refreshCount(user.id);
    };

    init();

    const onCarroUpdated = () => {
      refreshCount();
    };

    window.addEventListener(CARRO_UPDATED_EVENT, onCarroUpdated);

    return () => {
      active = false;
      window.removeEventListener(CARRO_UPDATED_EVENT, onCarroUpdated);
    };
  }, [refreshCount]);

  return (
    <button
      type="button"
      onClick={() => router.push('/comprador/carro')}
      aria-label={
        count > 0
          ? `Carro de compras, ${count} ofertas pendientes de pago`
          : 'Carro de compras'
      }
      style={styles.button}
    >
      <ShoppingCart size={22} strokeWidth={2.2} />
      {count > 0 && (
        <span style={styles.badge}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

const styles = {
  button: {
    position: 'relative',
    width: '46px',
    height: '46px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '14px',
    border: '1px solid #dbe5f1',
    background: '#f8fbff',
    color: '#17365e',
    cursor: 'pointer',
    flexShrink: 0,
  },
  badge: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    minWidth: '18px',
    height: '18px',
    padding: '0 5px',
    borderRadius: '999px',
    background: '#176bff',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 800,
    lineHeight: '18px',
    textAlign: 'center',
    boxShadow: '0 4px 10px rgba(23, 107, 255, 0.35)',
  },
};
