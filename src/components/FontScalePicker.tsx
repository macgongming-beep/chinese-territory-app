import { useState } from 'react'
import { t, type AppLanguage } from '../i18n'
import { applyFontScale, loadFontScale, saveFontScale, FONT_SCALES, type FontScale } from '../lib/fontScale'

/**
 * 글씨 크기 고르기. **모바일과 PC 가 같은 것을 쓴다.**
 *
 * ⚠ 한쪽에만 두면 안 된다: 확대는 화면 폭과 무관하게 걸리는데 설정이 모바일에만
 *   있으면, 태블릿을 돌려 폭이 980px 을 넘는 순간 **확대된 PC 화면에서 끄지 못한다.**
 *   (리뷰에서 잡혔다)
 *
 * 값은 스스로 읽고 쓴다 — 위에서 내려주면 두 화면이 어긋날 수 있다.
 */
export function FontScalePicker({ userId, language = 'ko' }: { userId?: number; language?: AppLanguage }) {
  const [scale, setScale] = useState<FontScale>(() => loadFontScale(userId))

  const change = (next: FontScale) => {
    setScale(next)
    saveFontScale(userId, next)
    applyFontScale(next)
  }

  return (
    <div className="mobile-language-grid">
      {FONT_SCALES.map((item) => (
        <button
          key={item}
          className={scale === item ? 'active' : ''}
          onClick={() => change(item)}
          type="button"
          /* 보기만 해도 차이를 알 수 있게 버튼 글씨도 그 크기로 */
          style={{ fontSize: item === 'normal' ? 14 : item === 'large' ? 16 : 18 }}
        >
          {t(language, `settings.fontScale.${item}`)}
        </button>
      ))}
    </div>
  )
}
