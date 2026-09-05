export type RestaurantRegistration = {
  name: string
  address: string
  existingBuildingId: number | null
}

export type RegisterRestaurant = (input: RestaurantRegistration) => Promise<boolean>
