import type { TimeSlot } from '../types'

/**
 * 사용자 정의 기준에 따라 현재 시간대를 반환합니다.
 * - 오전: 12시 이전
 * - 오후: 13시 ~ 16시 30분 (12~13시 포함)
 * - 저녁: 16시 30분 이후
 */
export function getCurrentTimeSlot(): TimeSlot {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const time = hours + minutes / 60

  if (time < 12) {
    return '오전'
  } else if (time < 16.5) {
    return '오후'
  } else {
    return '저녁'
  }
}

/**
 * 주어진 시각이 오늘인지 확인합니다.
 */
export function isToday(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  )
}
