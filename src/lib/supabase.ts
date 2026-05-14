import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Database 타입 주입은 기존 코드 타입 충돌로 보류
// src/types/supabase.ts는 참고용으로 유지 (필요 시 수동 import:
//   import type { Database } from '../types/supabase'
//   const rows: Database['public']['Tables']['notifications']['Row'][] = data
// )
// 추후 점진적으로 마이그레이션 후 createClient<Database> 적용
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
