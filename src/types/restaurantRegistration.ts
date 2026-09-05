export const RESTAURANT_INITIAL_STATES = [
  '미방문', '만남', '부재', '대상외', '거절', '확인필요', '정기방문',
] as const

export type RestaurantInitialState = (typeof RESTAURANT_INITIAL_STATES)[number]

export type RestaurantRegistration = {
  name: string
  address: string
  existingBuildingId: number | null
  lat?: number | null
  lng?: number | null
  isChinese: boolean
  initialState: RestaurantInitialState
  regularVisitor: string | null
}

export type RegisterRestaurant = (input: RestaurantRegistration) => Promise<boolean>

export type RestaurantRequestRegistration = Omit<RestaurantRegistration, 'existingBuildingId'> & {
  memo: string
}

export type SubmitRestaurantRequest = (input: RestaurantRequestRegistration) => Promise<boolean>
