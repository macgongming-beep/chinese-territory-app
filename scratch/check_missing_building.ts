
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

async function checkDb() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  console.log('--- Cards for 동백동 ---');
  const { data: cards, error: cardsError } = await supabase
    .from('territory_cards')
    .select('*')
    .ilike('area', '%동백%');
    
  if (cardsError) console.error(cardsError);
  else console.log(JSON.stringify(cards, null, 2));
  
  console.log('--- All Buildings ---');
  const { data: buildings, error: buildingsError } = await supabase
    .from('buildings')
    .select('*')
    .limit(10);
    
  if (buildingsError) console.error(buildingsError);
  else console.log(JSON.stringify(buildings, null, 2));
}

checkDb();
