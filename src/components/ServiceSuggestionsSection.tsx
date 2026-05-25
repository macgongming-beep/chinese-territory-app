import { useServiceSuggestions } from '../hooks/useServiceSuggestions'
import { useState, useEffect } from 'react'

export function ServiceSuggestionsSection() {
  const { suggestions, loading } = useServiceSuggestions()
  const [currentSuggestion, setCurrentSuggestion] = useState<any>(null)

  useEffect(() => {
    if (loading || !suggestions.length) return
    
    // Find all visible suggestions
    const visibleOnes = suggestions.filter(s => s.is_visible)
    if (visibleOnes.length === 0) {
      setCurrentSuggestion(null)
      return
    }

    // Sort by last_used_at descending, fallback to created_at
    visibleOnes.sort((a, b) => {
      const timeA = a.last_used_at ? new Date(a.last_used_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0)
      const timeB = b.last_used_at ? new Date(b.last_used_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0)
      return timeB - timeA
    })
    
    setCurrentSuggestion(visibleOnes[0])
  }, [suggestions, loading])

  if (loading) return null
  if (!currentSuggestion || currentSuggestion.content.length === 0) return null

  return (
    <section className="mobile-home-section" style={{ marginTop: 24 }}>
      <div className="mh-sec-head" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: 12 }}>
        <h2>대화 방법 제안</h2>
        {currentSuggestion.show_title_on_home && currentSuggestion.title && (
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600 }}>{currentSuggestion.title}</span>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {currentSuggestion.content.map((block: any, idx: number) => (
          <SuggestionCard key={idx} block={block} />
        ))}
      </div>
    </section>
  )
}

function SuggestionCard({ block }: { block: any }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--line-muted)', padding: 20, height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14, background: 'var(--bg-muted)', padding: '6px 10px', borderRadius: 6 }}>{block.type}</span>
      </div>
      
      {block.format === 'structured' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              질문
            </div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5 }}>
              {block.question}
            </div>
          </div>
          
          <div style={{ background: 'var(--tint)', padding: 12, borderRadius: 12, border: '1px solid var(--line-muted)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              성구
            </div>
            <div style={{ fontWeight: 700, color: 'var(--brand)', fontStyle: 'italic' }}>
              {block.scripture}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              다음 방문 기초
            </div>
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5, fontWeight: 500 }}>
              {block.next_visit}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, whiteSpace: 'pre-wrap', color: 'var(--text)', lineHeight: 1.6, fontSize: 14 }}>
          {block.body}
        </div>
      )}
    </div>
  )
}
