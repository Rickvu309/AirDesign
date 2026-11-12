import { editorRoutes } from "@/editor/editor-routes"
import {
  ActionsScreen,
  AgentComplete,
  AgentLong,
  AgentOwn,
  AgentWorking,
  DesignPanelScreen,
  ImagesScreen,
  Offline,
  RunFailed,
  ShapesExpandedScreen,
  ShapesScreen,
  TemplatePickerScreen,
  TextFormatScreen,
  TextScreen,
} from "@/editor/screens/slide-views"
import { GridAddHold, GridAddHover, GridDefault, GridPasted } from "@/editor/screens/grid-views"

export const screens = {
  [editorRoutes.gridDefault]: GridDefault,
  [editorRoutes.gridAddHover]: GridAddHover,
  [editorRoutes.gridAddHold]: GridAddHold,
  [editorRoutes.gridPasted]: GridPasted,
  [editorRoutes.agentWorking]: AgentWorking,
  [editorRoutes.agentComplete]: AgentComplete,
  [editorRoutes.agentOwn]: AgentOwn,
  [editorRoutes.agentLong]: AgentLong,
  [editorRoutes.templatePicker]: TemplatePickerScreen,
  [editorRoutes.designPanel]: DesignPanelScreen,
  [editorRoutes.images]: ImagesScreen,
  [editorRoutes.shapes]: ShapesScreen,
  [editorRoutes.shapesExpanded]: ShapesExpandedScreen,
  [editorRoutes.text]: TextScreen,
  [editorRoutes.actions]: ActionsScreen,
  [editorRoutes.textFormat]: TextFormatScreen,
  [editorRoutes.runFailed]: RunFailed,
  [editorRoutes.offline]: Offline,
}
