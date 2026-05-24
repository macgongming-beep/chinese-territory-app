import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ServiceSuggestion } from '../types'
import { toServiceSuggestion } from './storeTransforms'

export function useServiceSuggestions() {
  const [suggestions, setSuggestions] = useState<ServiceSuggestion[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSuggestions = async () => {
    try {
      const { data, error } = await supabase
        .from('service_suggestions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      if (data) {
        setSuggestions(data.map(toServiceSuggestion))
      }
    } catch (err) {
      console.error('Failed to fetch service suggestions:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuggestions()
  }, [])

  return { suggestions, loading, fetchSuggestions }
}
