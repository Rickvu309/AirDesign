import { presentRoutes } from "@/present/present-routes"
import { Presenter, PresenterLast, ShowControls, ShowEnd, ShowGoTo, ShowSlide } from "@/present/screens/present-states"

export const screens = {
  [presentRoutes.show]: ShowSlide,
  [presentRoutes.controls]: ShowControls,
  [presentRoutes.goTo]: ShowGoTo,
  [presentRoutes.end]: ShowEnd,
  [presentRoutes.presenter]: Presenter,
  [presentRoutes.presenterLast]: PresenterLast,
}
