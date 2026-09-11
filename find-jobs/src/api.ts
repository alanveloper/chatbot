// URL base del backend. En desarrollo apunta al Express local; en producción
// (Vercel) a la Edge Function enfoca-api de Supabase. VITE_API_URL manda en ambos.
const SUPABASE_FUNCTION_URL = 'https://xhjcweizspfcpjocgtcl.supabase.co/functions/v1/enfoca-api'

export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : SUPABASE_FUNCTION_URL)
