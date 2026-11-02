// One-off: give the generated Lunagraph components readable names.
// Rewrites lunagraph/components/airdesign/*.tsx and manifest.json in place.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../lunagraph/components/airdesign");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));

// Icons named from the rendered shapes.
const icons = {
  "": "NotificationBell", 2: "Search", 3: "Clock", 4: "Resources", 5: "File", 6: "GridSmall", 7: "Layout", 8: "Trash", 9: "Settings",
  10: "ChevronDownMuted", 11: "Folder", 12: "Folder", 13: "BrandMark", 14: "BrandMark", 15: "Slides", 16: "Sparkle",
  17: "SlidesFilled", 18: "ChevronDownBlue", 19: "ChevronDownMuted", 20: "GridSmall", 21: "List", 22: "SlidesFilled",
  23: "ChevronDown", 24: "ChevronDownMuted", 25: "PlusMuted", 26: "SlidesOrange", 27: "PrototypeTools", 28: "FileOrange",
  29: "Sparkle", 30: "AddCircle", 31: "ChevronDown", 32: "GridLarge", 33: "SlidesFilledLarge", 34: "Close", 35: "Plus",
  36: "SelectOrange", 37: "File", 38: "SparkleOrange", 39: "AddCircle", 40: "ChevronDown", 41: "GridLarge", 42: "More",
  43: "AddShapeOrange", 44: "PaletteMuted", 45: "ChevronDownMuted", 46: "AddCircleMuted", 47: "ChevronDownMuted",
  48: "AddTextBlock", 49: "AiList", 50: "Plus", 51: "Palette", 52: "MicOrange", 53: "ArrowUp", 54: "Sparkle",
  55: "SlidesOrange", 56: "PrototypeTools", 57: "FileOrange", 58: "Sparkle", 59: "AddCircleOrange", 60: "Table",
  61: "CodeBlock", 62: "SlideNumber", 63: "BrandLetter", 64: "PinkStroke", 65: "ChevronDown", 66: "SlideView",
  67: "ChevronLeft", 68: "SearchMuted", 69: "AddImage", 70: "Upload", 71: "Cursor", 72: "Hand", 73: "ScaleTool",
  74: "AiText", 75: "Adjust", 76: "Frame", 77: "Texture", 78: "Image", 79: "ChevronDown", 80: "ChevronDown",
  81: "ChevronDownMuted", 82: "PlusMuted", 83: "SlidesOrange", 84: "PrototypeTools", 85: "ShapeSquare", 86: "ShapeCircle",
  87: "ShapeDiamond", 88: "ShapeTriangle", 89: "ShapeStar", 90: "ShapeCross", 91: "ShapeArrowLeft", 92: "ShapeArrowRight",
  93: "ShapeSpeechBubble", 94: "Globe", 95: "ChevronRight", 96: "Play", 97: "CodeFrame", 98: "UploadFolder", 99: "Close",
  100: "Layout", 101: "ChevronRight", 102: "Play", 103: "CodeFrame", 104: "UploadFolder", 105: "ChevronDown",
  106: "SlideView", 107: "ChevronLeft", 108: "ChevronDownMuted", 109: "ChevronRightMuted",
};
const explicit = {};
for (const [n, b] of Object.entries(icons)) explicit[`InterfaceIcon${n}`] = `${b}Icon`;
for (let i = 1; i <= 24; i++) explicit[i === 1 ? "IconButton" : `IconButton${i}`] = `MediaThumbnail${String(i).padStart(2, "0")}`;
Object.assign(explicit, {
  IconButton25: "TextStyleTitleButton", IconButton26: "TextStyleHeader1Button", IconButton27: "TextStyleHeader2Button",
  IconButton28: "TextStyleHeader3Button", IconButton29: "TextStyleBody1Button", IconButton30: "TextStyleBody2Button",
  IconButton31: "TextStyleBody3Button", IconButton32: "TextStyleNoteButton",
  // demo data and sentence-like names
  AccountDropdownForQuanVuRichardButton: "AccountMenuButton", AccountDropdownForQuanVuRichardIcon: "AccountMenuIcon",
  NotificationsNewNotificationReceivedButton: "NotificationsButton", PlanQuanVuButton: "PlanButton", PlanQuanVuIcon: "PlanIcon",
  ChangePlanQuanVuIsCurrentlyOnTheProfessionalPlanButton: "ChangePlanButton", QuanVuRichardButton: "AccountButton",
  Admin2Button: "AdminButton", Value2AdminNotificationsBadge: "AdminNotificationsBadge",
  Quan01PersonalProjectButton: "PersonalProjectButton", Quan02WorkProjectButton: "WorkProjectButton",
  Quan03CollabButton: "CollabProjectButton", Quan99ArchiveButton: "ArchiveProjectButton",
  NovaMembershipButton: "RecentFileButtonNovaMembership", ProjectConsultingButton: "RecentFileButtonProjectConsulting",
  ProfessionalTemplateButton: "RecentFileButtonProfessionalTemplate", VietjetProjectButton: "RecentFileButtonVietjetProject",
  GrokBotSlideButton: "RecentFileButtonGrokBotSlide",
  DesignDesignButton: "DesignTabButton", AnimateAnimateButton: "AnimateTabButton",
  Value100ZoomAndViewOptionsButton: "ZoomAndViewOptionsButton", Value100ZoomAndViewOptionsIcon: "ZoomAndViewOptionsIcon",
  NewChatJustNowNotStartedButton: "NewChatButton", UntitledFileNameButton: "FileNameButton",
  StyleLightSlidesFontsInterButton: "StyleOptionsButton",
  ColorVariableBlackWithValue000At100Button: "ColorSwatchBlackButton", ColorVariableWhiteWithValueFFFAt100Button: "ColorSwatchWhiteButton",
  AddCommaSeparatedEmailsToInviteInput: "InviteEmailsInput", InviteEmailFieldButton: "InviteEmailFieldButton",
});

const screen = {
  "00-Home.jsx": "Home", "01-Getting-started.jsx": "GettingStarted", "ShapesEditorToolbar.jsx": "Shapes",
  "AgentsPanel.jsx": "Agents", "MediaPanel.jsx": "Media", "TextPanel.jsx": "Text", "ShareDialog.jsx": "Share",
  "EditorToolbar.jsx": "Editor", "InsertPanel.jsx": "Insert", "PropertiesPanel.jsx": "Properties", "FilePanel.jsx": "File",
  "ShareMoreActions.jsx": "ShareMore", "MoveMenu.jsx": "MoveMenu", "Logo.jsx": "Logo", "PresenterNotes.jsx": "Notes",
};

// 1) base names; trailing numbers are variants of the same component
const info = manifest.map((m) => {
  let base = explicit[m.name] ?? m.name;
  if (!explicit[m.name]) base = base.replace(/(?<=[A-Za-z])\d+$/, "").replace(/(?<=[A-Za-z])(\d+)(Button|Icon|Group|Toolbar|Input)$/, "$2");
  return { ...m, base };
});
// 2) families with several members get a screen prefix; leftovers get a number
const count = {};
info.forEach((i) => (count[i.base] = (count[i.base] ?? 0) + 1));
const used = new Map();
const map = {};
for (const i of info) {
  let name = count[i.base] > 1 ? `${screen[i.source] ?? "X"}${i.base}` : i.base;
  const n = (used.get(name) ?? 0) + 1;
  used.set(name, n);
  if (n > 1) name = `${name}${n}`;
  if (name !== i.name) map[i.name] = name;
}
// keep the first of each same-screen duplicate un-numbered but unique: already handled by n above
const names = Object.keys(map).sort((a, b) => b.length - a.length);
const re = new RegExp(`\\b(${names.join("|")})(Default)?\\b`, "g");
const swap = (s) => s.replace(re, (_, n, d) => map[n] + (d ?? ""));
for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  writeFileSync(p, swap(readFileSync(p, "utf8")));
}
writeFileSync(join(dir, "rename-map.json"), JSON.stringify(map, null, 2) + "\n");
console.log(`renamed ${Object.keys(map).length} of ${manifest.length}`);
