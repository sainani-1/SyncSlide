import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 60,
    },
  },
})

export const STORAGE_BUCKET = 'slides'

export async function getStorageUrl(path: string) {
  const storage = supabase.storage.from(STORAGE_BUCKET)

  try {
    const { data, error } = await storage.createSignedUrl(path, 60 * 60 * 24 * 7)
    if (!error && data?.signedUrl) {
      return data.signedUrl
    }
  } catch {
    // Fall back to the public URL below.
  }

  const { data } = storage.getPublicUrl(path)
  return data.publicUrl
}

export function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
