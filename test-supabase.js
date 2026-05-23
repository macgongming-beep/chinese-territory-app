import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data: users, error: err1 } = await supabase.from('app_users').select('id, name, last_login_at').order('last_login_at', { ascending: false }).limit(5)
  console.log('--- app_users (last_login_at) ---')
  if (err1) console.error(err1)
  else console.log(users)

  const { data: logs, error: err2 } = await supabase.from('login_logs').select('*').order('logged_in_at', { ascending: false }).limit(5)
  console.log('--- login_logs ---')
  if (err2) console.error(err2)
  else console.log(logs)

  const { data: sessions, error: err3 } = await supabase.from('service_sessions').select('*').order('started_at', { ascending: false }).limit(5)
  console.log('--- service_sessions ---')
  if (err3) console.error(err3)
  else console.log(sessions)
}

run()
