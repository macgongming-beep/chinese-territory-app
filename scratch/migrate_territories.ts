
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const DATA_FILE = 'dragnet-polygons.json'

// Mapping areas to Regions
const REGION_MAP: Record<string, string> = {
  // Cheoin-gu
  '고림동': '처인구', '김량장동': '처인구', '남동': '처인구', '남사읍': '처인구', '마평동': '처인구', 
  '모현읍': '처인구', '백암면': '처인구', '삼가동': '처인구', '역북동': '처인구', '운학동': '처인구', 
  '원삼면': '처인구', '유방동': '처인구', '이동읍': '처인구', '포곡읍': '처인구', '양지면': '처인구',
  // Giheung-gu
  '구갈동': '기흥구', '구성동': '기흥구', '기흥동': '기흥구', '마북동': '기흥구', '보라동': '기흥구', 
  '보정동': '기흥구', '상갈동': '기흥구', '상하동': '기흥구', '신갈동': '기흥구', '영덕동': '기흥구', 
  '서천동': '기흥구', '지곡동': '기흥구', '동백동': '기흥구',
  // Suji-gu
  '고기동': '수지구', '동천동': '수지구', '상현동': '수지구', '성복동': '수지구', '신봉동': '수지구', 
  '죽전동': '수지구', '풍덕천동': '수지구',
  // Yeongtong-gu (Suwon)
  '영통동': '영통구', '매탄동': '영통구',
  // Hwaseong-si
  '병점동': '화성시', '장지동': '화성시', '오산동': '화성시', '영천동': '화성시', '송동': '화성시'
}

async function migrate() {
  console.log('--- Starting Migration ---')

  // 1. Cleanup
  console.log('Cleaning up existing territory data...')
  await supabase.from('visit_histories').delete().neq('id', 0)
  await supabase.from('regular_visits').delete().neq('id', 0)
  await supabase.from('units').delete().neq('id', 0)
  await supabase.from('buildings').delete().neq('id', 0)
  await supabase.from('card_assignments').delete().neq('card_id', 0)
  await supabase.from('card_boundaries').delete().neq('card_id', 0)
  const { error: cardDeleteErr } = await supabase.from('cards').delete().neq('id', 0)
  if (cardDeleteErr) {
    console.error('Failed to clear cards table:', cardDeleteErr)
    return
  }
  console.log('Cleanup complete.')

  // 2. Load JSON
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`Data file ${DATA_FILE} not found.`)
    return
  }
  const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  console.log(`Loaded ${rawData.length} zones from JSON.`)

  // 3. Process Zones
  const cardsToInsert: any[] = []
  const boundariesToInsert: any[] = []

  for (const zone of rawData) {
    // zoneCode: "고기동 001" or "남사읍019"
    // zoneName: descriptive but we'll use Area + Index
    
    // Extract Area and Index
    let area = ''
    let indexStr = ''
    
    const match = zone.zoneCode.match(/^([가-힣]+)\s?(\d+)/)
    if (match) {
      area = match[1]
      indexStr = parseInt(match[2], 10).toString()
    } else {
      area = zone.zoneCode.replace(/[\d\s]/g, '')
      indexStr = zone.zoneCode.replace(/\D/g, '') || '1'
    }

    const region = REGION_MAP[area] || '기타'
    const name = `${region} ${area} ${indexStr}`

    cardsToInsert.push({
      name,
      area,
      region,
      type: '전체',
      status: '미배정'
    })
  }

  // 4. Batch Insert Cards
  console.log(`Inserting ${cardsToInsert.length} cards...`)
  // We need to insert in chunks to get IDs back for boundaries
  const BATCH_SIZE = 50
  for (let i = 0; i < cardsToInsert.length; i += BATCH_SIZE) {
    const chunk = cardsToInsert.slice(i, i + BATCH_SIZE)
    const { data: insertedCards, error: insertErr } = await supabase
      .from('cards')
      .insert(chunk)
      .select('id, name')

    if (insertErr) {
      console.error(`Batch insert failed at ${i}:`, insertErr)
      continue
    }

    // Map inserted IDs to boundaries
    for (const card of insertedCards!) {
      const originalZone = rawData.find((z: any) => {
         const match = z.zoneCode.match(/^([가-힣]+)\s?(\d+)/)
         let zArea = '', zIndex = ''
         if (match) {
            zArea = match[1]
            zIndex = parseInt(match[2], 10).toString()
         } else {
            zArea = z.zoneCode.replace(/[\d\s]/g, '')
            zIndex = z.zoneCode.replace(/\D/g, '') || '1'
         }
         const zRegion = REGION_MAP[zArea] || '기타'
         return `${zRegion} ${zArea} ${zIndex}` === card.name
      })

      if (originalZone && originalZone.paths) {
        boundariesToInsert.push({
          card_id: card.id,
          points: originalZone.paths.map((p: any) => ({ lng: p[0], lat: p[1] }))
        })
      }
    }
  }

  // 5. Batch Insert Boundaries
  console.log(`Inserting ${boundariesToInsert.length} boundaries...`)
  for (let i = 0; i < boundariesToInsert.length; i += BATCH_SIZE) {
    const chunk = boundariesToInsert.slice(i, i + BATCH_SIZE)
    const { error: bErr } = await supabase.from('card_boundaries').insert(chunk)
    if (bErr) {
      console.error(`Boundary insert failed at ${i}:`, bErr)
    }
  }

  console.log('--- Migration Complete ---')
}

migrate()
