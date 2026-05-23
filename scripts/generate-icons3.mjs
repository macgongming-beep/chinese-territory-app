import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

const CHARCOAL  = '#1A1A1A'
const COBALT    = '#1848A8'
const WARM_DARK = '#2D2926'
const FOREST    = '#1B3A2D'

const W    = 'rgba(255,255,255,0.95)'
const W_MD = 'rgba(255,255,255,0.50)'
const W_DM = 'rgba(255,255,255,0.18)'

// ── I: 헥사곤 구역 ─────────────────────────────────────────
// 육각형 = GIS·전략맵·구역 분할의 상징
// 바깥 테두리 헥사곤 + 안쪽 채워진 헥사곤 + 핀 닷
function hexSVG(bg) {
  // 정육각형 꼭짓점 (중심 256,248, 반지름 148)
  const cx = 256, cy = 248, r = 148, ri = 80
  const hex = (radius, offsetAngle = 0) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 90 + offsetAngle)
      return `${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`
    }).join(' ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 바깥 헥사곤 (테두리) -->
  <polygon points="${hex(148)}" fill="none" stroke="${W}" stroke-width="26" stroke-linejoin="round" opacity="0.9"/>
  <!-- 안쪽 헥사곤 (채움) -->
  <polygon points="${hex(72)}" fill="${W}" opacity="0.22"/>
  <!-- 구역선: 헥사곤 중심에서 꼭짓점까지 3개 선 (x자 분할) -->
  <line x1="${cx}" y1="${cy}" x2="${(cx + 148 * Math.cos(-Math.PI/2)).toFixed(0)}" y2="${(cy + 148 * Math.sin(-Math.PI/2)).toFixed(0)}" stroke="${W}" stroke-width="14" opacity="0.22"/>
  <line x1="${cx}" y1="${cy}" x2="${(cx + 148 * Math.cos(-Math.PI/2 + Math.PI*2/3)).toFixed(0)}" y2="${(cy + 148 * Math.sin(-Math.PI/2 + Math.PI*2/3)).toFixed(0)}" stroke="${W}" stroke-width="14" opacity="0.22"/>
  <line x1="${cx}" y1="${cy}" x2="${(cx + 148 * Math.cos(-Math.PI/2 + Math.PI*4/3)).toFixed(0)}" y2="${(cy + 148 * Math.sin(-Math.PI/2 + Math.PI*4/3)).toFixed(0)}" stroke="${W}" stroke-width="14" opacity="0.22"/>
  <!-- 중심 닷 -->
  <circle cx="${cx}" cy="${cy}" r="22" fill="${W}"/>
  <!-- 핀 꼬리 -->
  <line x1="${cx}" y1="${cy + 22}" x2="${cx}" y2="${cy + 72}" stroke="${W}" stroke-width="18" stroke-linecap="round" opacity="0.7"/>
</svg>`
}

// ── J: 도로 격자 (Street Grid) ────────────────────────────
// 지도의 도로망을 위에서 내려다본 시점 — 가장 직관적 "지도" 심볼
function gridMapSVG(bg) {
  const sw = 22  // stroke width (도로 굵기)
  const pad = 108
  const step = (512 - pad * 2) / 2  // 두 칸 격자
  const lines = []
  // 수평 3줄
  for (let i = 0; i <= 2; i++) {
    const y = pad + i * step
    lines.push(`<line x1="${pad}" y1="${y}" x2="${512 - pad}" y2="${y}" stroke="${W}" stroke-width="${sw}" stroke-linecap="round"/>`)
  }
  // 수직 3줄
  for (let i = 0; i <= 2; i++) {
    const x = pad + i * step
    lines.push(`<line x1="${x}" y1="${pad}" x2="${x}" y2="${512 - pad}" stroke="${W}" stroke-width="${sw}" stroke-linecap="round"/>`)
  }
  // 교차점에 닷 (9개 중 가운데 것만 강조)
  const dots = []
  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c <= 2; c++) {
      const x = pad + c * step, y = pad + r * step
      const isCenter = r === 1 && c === 1
      dots.push(`<circle cx="${x}" cy="${y}" r="${isCenter ? 24 : 14}" fill="${isCenter ? W : bg}" ${isCenter ? '' : `stroke="${W}" stroke-width="8"`} opacity="${isCenter ? 1 : 0.7}"/>`)
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  ${lines.join('\n  ')}
  ${dots.join('\n  ')}
</svg>`
}

// ── K: 구역 폴리곤 + 핀 ────────────────────────────────────
// 실제 행정구역 경계선 같은 불규칙 다각형 + 위치 마커
function polygonPinSVG(bg) {
  // 약간 불규칙한 7각형 (실제 구역 경계처럼)
  const pts = '256,100 368,148 412,252 374,358 256,400 138,358 100,252 138,148'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 구역 영역 채움 -->
  <polygon points="${pts}" fill="${W}" opacity="0.13"/>
  <!-- 구역 경계선 -->
  <polygon points="${pts}" fill="none" stroke="${W}" stroke-width="24" stroke-linejoin="round" opacity="0.88"/>
  <!-- 위치 핀 (상단 중앙) -->
  <!-- 핀 원 -->
  <circle cx="256" cy="192" r="40" fill="${W}"/>
  <!-- 핀 꼬리 삼각 -->
  <polygon points="232,224 280,224 256,270" fill="${W}"/>
  <!-- 핀 안쪽 구멍 -->
  <circle cx="256" cy="192" r="18" fill="${bg}"/>
</svg>`
}

// ── L: 동심 구역 링 (Concentric Zones) ───────────────────
// 토포그래픽 지도처럼 겹쳐진 구역 레이어 — "구역 안의 구역"
function concentricSVG(bg) {
  const cx = 256, cy = 256
  // 3개의 동심 헥사곤 (크기만 다름)
  const hex = (r) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 90)
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
    }).join(' ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 바깥 구역 -->
  <polygon points="${hex(168)}" fill="none" stroke="${W}" stroke-width="20" stroke-linejoin="round" opacity="0.28"/>
  <!-- 중간 구역 -->
  <polygon points="${hex(112)}" fill="none" stroke="${W}" stroke-width="22" stroke-linejoin="round" opacity="0.55"/>
  <!-- 안쪽 구역 -->
  <polygon points="${hex(56)}"  fill="${W}" opacity="0.88"/>
  <!-- 중심 닷 (bg 색) -->
  <circle cx="${cx}" cy="${cy}" r="18" fill="${bg}"/>
</svg>`
}

// ── 생성 ────────────────────────────────────────────────────
const COLORS = [
  { key: 'charcoal', bg: CHARCOAL,  label: '차콜' },
  { key: 'cobalt',   bg: COBALT,    label: '코발트' },
  { key: 'warm',     bg: WARM_DARK, label: '웜다크' },
  { key: 'forest',   bg: FOREST,    label: '포레스트' },
]

const SYMBOLS = [
  { key: 'I', label: '헥사곤 구역',    fn: hexSVG },
  { key: 'J', label: '도로 격자',      fn: gridMapSVG },
  { key: 'K', label: '구역 폴리곤+핀', fn: polygonPinSVG },
  { key: 'L', label: '동심 구역 링',   fn: concentricSVG },
]

const designs = []
for (const sym of SYMBOLS) {
  for (const col of COLORS) {
    const name = `prev3-${sym.key}-${col.key}`
    designs.push({ name, svg: sym.fn(col.bg), sym, col })
  }
}

for (const { name, svg } of designs) {
  const out = path.join(outDir, `${name}.png`)
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(out)
  process.stdout.write(`✓ ${name}\n`)
}

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>아이콘 비교 3차 — 지도/구역 특화</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #EDECE9; padding: 40px 32px 80px; }
  h1 { font-size: 18px; font-weight: 700; color: #1A1A1A; margin-bottom: 6px; }
  p  { font-size: 13px; color: #888; margin-bottom: 36px; }
  .section { margin-bottom: 40px; }
  .section h2 { font-size: 11px; font-weight: 700; color: #1848A8;
                letter-spacing:.1em; text-transform: uppercase; margin-bottom: 14px; }
  .row { display: flex; gap: 14px; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .card img { width: 96px; height: 96px; border-radius: 20px;
              box-shadow: 0 3px 16px rgba(0,0,0,.22); }
  .lbl { font-size: 11px; color: #999; }
</style>
</head>
<body>
<h1>아이콘 3차 — 구역 관리 · 지도 특화</h1>
<p>I·J·K·L 4가지 × 차콜 / 코발트 / 웜다크 / 포레스트</p>
${SYMBOLS.map(sym => `
<div class="section">
  <h2>${sym.key} — ${sym.label}</h2>
  <div class="row">
    ${COLORS.map(col => `
    <div class="card">
      <img src="prev3-${sym.key}-${col.key}.png">
      <span class="lbl">${col.label}</span>
    </div>`).join('')}
  </div>
</div>`).join('')}
</body>
</html>`

writeFileSync(path.join(outDir, 'icon-preview3.html'), html)
console.log('\n✅ 완료!')
