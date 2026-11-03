export { Icon, type IconProps } from "./icons/Icon.js";
export { iconData, type IconName } from "./icons/icon-data.js";
export { Button, type ButtonProps } from "./components/Button.js";
export { IconButton, type IconButtonProps } from "./components/IconButton.js";
export { Input, SearchField, type InputProps } from "./components/Input.js";
export { Avatar, type AvatarProps } from "./components/Avatar.js";
export { Badge, type BadgeProps } from "./components/Badge.js";
export { Divider, type DividerProps } from "./components/Divider.js";
export { Tabs, type TabsProps, type TabItem } from "./components/Tabs.js";
export { Menu, MenuItem, type MenuItemProps } from "./components/Menu.js";
export { Card, type CardProps } from "./components/Card.js";
export { Switch, type SwitchProps } from "./components/Switch.js";
export { Dialog, type DialogProps } from "./components/Dialog.js";
export { Tooltip, type TooltipProps } from "./components/Tooltip.js";
export { Checkbox, type CheckboxProps } from "./components/Checkbox.js";
export { RadioGroup, type RadioGroupProps, type RadioOption } from "./components/RadioGroup.js";
export { Textarea, type TextareaProps } from "./components/Textarea.js";
export { Select, type SelectProps, type SelectOption } from "./components/Select.js";
export { Slider, type SliderProps } from "./components/Slider.js";
export { NumberField, type NumberFieldProps } from "./components/NumberField.js";
export { ColorSwatch, type ColorSwatchProps } from "./components/ColorSwatch.js";
export { Spinner, Progress, Skeleton, EmptyState, Alert, type ProgressProps, type EmptyStateProps, type AlertProps } from "./components/Feedback.js";
export { Popover, type PopoverProps } from "./components/Popover.js";
export { Toolbar, ToolbarGroup, ToolbarSeparator, type ToolbarProps } from "./components/Toolbar.js";
export { Sidebar, SidebarSection, SidebarItem, type SidebarItemProps } from "./components/Sidebar.js";
export { Breadcrumbs, type BreadcrumbsProps, type Crumb } from "./components/Breadcrumbs.js";
export { Accordion, AccordionItem, type AccordionItemProps } from "./components/Accordion.js";
export { Kbd } from "./components/Kbd.js";
export { PropertySection, PropertyRow } from "./components/PropertyPanel.js";
export { ChatThread, ChatMessage, Suggestion, ChatComposer, type ChatMessageProps, type ChatComposerProps } from "./components/Chat.js";
export { NavRail, NavRailItem, type NavRailItemProps } from "./components/NavRail.js";
export { createMachine, useMachine } from "./machine/createMachine.js";
export type { Machine, MachineConfig, MachineEvent, RegionConfig, Snapshot, StateConfig, Transition } from "./machine/createMachine.js";
export { editorMachine, restoreEditor } from "./machine/editorMachine.js";
export type { EditorContext, EditorEvent, EditorPanel, EditorSnapshot } from "./machine/editorMachine.js";
export { useEditorMachine } from "./machine/useEditorMachine.js";
export {
  selectLayout,
  selectPanel,
  selectCanvas,
  selectOverlay,
  selectTray,
  selectDeck,
  selectZoom,
  selectSlides,
  selectSelected,
  selectPresenting,
  type EditorLayout,
} from "./machine/editorSelectors.js";
export {
  AppMark,
  type AppMarkProps,
  HelpButton,
  type HelpButtonProps,
  SlideThumb,
  type SlideThumbProps,
  PanelHeader,
  type PanelHeaderProps,
  FilePanel,
  type FilePanelProps,
  AgentsPanel,
  type AgentsPanelProps,
  InsertsPanel,
  type InsertsPanelProps,
  MediaPanel,
  type MediaPanelProps,
  InspectorHead,
  type InspectorHeadProps,
  SlideInspector,
  type SlideInspectorProps,
  BottomToolbar,
  type BottomToolbarProps,
  ShapesTray,
  type ShapesTrayProps,
  PresenterNotes,
  type PresenterNotesProps,
  GettingStartedDialog,
  type GettingStartedDialogProps,
  ShareDialog,
  type ShareDialogProps,
  HomeSidebar,
  type HomeSidebarProps,
  HomeFileToolbar,
  type HomeFileToolbarProps,
  HomeFileList,
  type HomeFileListProps,
  type HomeFileItem,
  defaultHomeFiles,
  EditorWorkspace,
  type EditorWorkspaceProps,
  EmptyDeck,
  type EmptyDeckProps,
  TemplateGallery,
  type TemplateGalleryProps,
  type TemplateCardItem,
  defaultTemplates,
  DraftingState,
  type DraftingStateProps,
  PresentView,
  type PresentViewProps,
} from "./workspace/index.js";
