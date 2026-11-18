import { exportRoutes } from "@/export/export-routes"
import { ExportFailedScreen, PdfOptions, PowerpointOptions } from "@/export/screens/export-states"

export const screens = {
  [exportRoutes.powerpoint]: PowerpointOptions,
  [exportRoutes.pdf]: PdfOptions,
  [exportRoutes.failed]: ExportFailedScreen,
}
