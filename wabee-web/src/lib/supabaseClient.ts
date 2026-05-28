import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '[supabaseClient] Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. ' +
        'El flujo de verificación de correo no funcionará correctamente.'
    );
}

// IMPORTANTE: Solo usar la ANON KEY aquí, NUNCA la SERVICE_ROLE key.
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
