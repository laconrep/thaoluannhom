import { createBrowserClient } from "@supabase/ssr"

let _client: ReturnType<typeof createBrowserClient> | null = null

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error("Supabase browser configuration is missing")
  }

  return { url, key }
}

export function createClient() {
  if (_client) return _client
  const { url, key } = getSupabaseConfig()
  _client = createBrowserClient(url, key)
  return _client
}
