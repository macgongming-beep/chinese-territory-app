// 날짜 공용 유틸 (여러 컴포넌트/훅에서 중복 정의되던 것 통합)

// 주어진 Date 를 로컬 타임존 기준 'YYYY-MM-DD' 로 반환.
// ⚠️ toISOString().slice(0,10) 은 UTC 라 KST 새벽(00~09시)엔 하루 어긋남 →
//    로컬 날짜가 필요하면 이 함수를 쓸 것.
export function toLocalDateString(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// 로컬 타임존 기준 오늘 날짜 'YYYY-MM-DD'
export function getLocalDateString(): string {
  return toLocalDateString(new Date())
}
