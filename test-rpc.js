import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase.rpc('update_last_login', { p_user_id: 5 })
  console.log(data, error)
}

run()
