import { createClient, SupabaseClient } from '@supabase/supabase-js';

const sanitizeConfigValue = (val: string | undefined | null) => {
  if (!val) return null;
  const cleaned = val.trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return null;
  const lowers = cleaned.toLowerCase();
  
  if (
    lowers === 'your_supabase_url' ||
    lowers === 'your_supabase_anon_key' ||
    lowers === 'your_supabase_url_here' ||
    lowers === 'my_supabase_url' ||
    lowers === 'my_supabase_anon_key' ||
    lowers.includes('your_supabase_') ||
    lowers.includes('placeholder')
  ) {
    return null;
  }
  
  return cleaned;
};

export const getSupabaseUrl = () => {
  const envVal = sanitizeConfigValue(import.meta.env.VITE_SUPABASE_URL);
  if (envVal) return envVal;
  return sanitizeConfigValue(localStorage.getItem('SUPABASE_URL'));
};

export const getSupabaseKey = () => {
  const envVal = sanitizeConfigValue(import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (envVal) return envVal;
  return sanitizeConfigValue(localStorage.getItem('SUPABASE_KEY'));
};

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let urlStr = '';
  if (typeof input === 'string') {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input && typeof input === 'object' && 'url' in input) {
    urlStr = (input as any).url || '';
  }

  const targetUrlString = getSupabaseUrl();
  if (targetUrlString && urlStr.startsWith(targetUrlString)) {
    const pathSuffix = urlStr.substring(targetUrlString.length);
    const proxyUrl = `/api/supabase-proxy${pathSuffix}`;
    
    if (typeof input === 'string') {
      return fetch(proxyUrl, init);
    } else if (input instanceof URL) {
      return fetch(new URL(proxyUrl, window.location.origin), init);
    } else {
      return fetch(new Request(proxyUrl, input as any), init);
    }
  }
  return fetch(input, init);
};

let supabaseInstance: SupabaseClient | null = null;

export const supabase = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const url = getSupabaseUrl();
  const key = getSupabaseKey();

  if (!url || !key) {
    throw new Error('Supabase credentials missing.');
  }

  supabaseInstance = createClient(url, key, {
    global: {
      fetch: customFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });
  return supabaseInstance;
};

export const hasSupabaseConfig = () => {
  return !!getSupabaseUrl() && !!getSupabaseKey();
};
