// 날짜 공용 유틸 (여러 컴포넌트/훅에서 중복 정의되던 것 통합)

// 로컬 타임존 기준 오늘 날짜를 'YYYY-MM-DD' 로 반환.
// (toISOString() 은 UTC 라 자정 전후로 하루 어긋날 수 있어 직접 조합한다)
export function getLocalDateString(): string {
  const date = new Date()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
