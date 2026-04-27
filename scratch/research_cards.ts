
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function research() {
  const { data: cards, error } = await supabase.from('cards').select('id, name, region, area')
  if (error) {
    console.error('Error fetching cards:', error)
    return
  }
  console.log('Current Cards in DB:', JSON.stringify(cards, null, 2))
}

 research()
