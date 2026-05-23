import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.from('app_users').update({ last_login_at: new Date().toISOString() }).eq('id', 5).select()
  console.log('Update result:', data, error)
}

run()
