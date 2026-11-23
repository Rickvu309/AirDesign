import { creditsRoutes } from "@/credits/credits-routes"
import { LimitReached } from "@/credits/screens/limit-reached"

export const screens = {
  [creditsRoutes.limit]: LimitReached,
}
