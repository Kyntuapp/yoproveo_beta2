// lib/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 🔍 Consolas de depuración para confirmar lectura de variables
console.log('✅ Supabase URL:', supabaseUrl);
console.log('✅ Supabase Anon Key:', supabaseAnonKey ? 'Cargada correctamente' : 'No cargada (undefined)');

// Validación explícita (opcional pero útil)
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Las variables de entorno de Supabase no están definidas. Verifica tu archivo .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
