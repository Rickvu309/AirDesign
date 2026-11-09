import { exportRoutes } from "@/export/export-routes"
import { DownloadedToastScreen, ExportFailedScreen, PdfOptions, PowerpointOptions } from "@/export/screens/export-states"

export const screens = {
  [exportRoutes.powerpoint]: PowerpointOptions,
  [exportRoutes.pdf]: PdfOptions,
  [exportRoutes.downloaded]: DownloadedToastScreen,
  [exportRoutes.failed]: ExportFailedScreen,
}
