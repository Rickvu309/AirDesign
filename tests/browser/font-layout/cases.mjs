const fallback = ["Geist", "Symbols", "Emoji"]
const item = (id, text, faces, lang = "en-US", extra = {}) => ({
  id,
  lang,
  runs: [{ text, faces: [...new Set([...faces, ...fallback])], size: 44, weight: 400, ...extra }],
})
const emoji = {
  zwj: "👩‍💻👨‍👩‍👧",
  flag: "🇻🇳🇰🇷",
  keycap: "1️⃣",
  "keycap-no-vs": "#⃣",
  "tag-flag": "\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}",
  skin: "👍🏽",
  "heart-vs15": "❤︎",
  "smile-vs15": "☺︎",
  "heart-vs16": "❤️",
  plain: "🚀",
  "text-default": "☺",
  "lone-modifier": "🏽",
  "lone-ri": "🇦",
  hair: "🦰",
  "zwj-no-emoji": "a‍b",
  zwnj: "a‌b",
  "copyright-vs15": "©︎",
  "lone-vs15": "\uFE0E",
}
export const corpus = [
  item("arabic-joining", "السلام عليكم ورحمة الله", ["Arabic"], "ar"),
  item("arabic-mixed-bidi", "Revenue نمت الإيرادات (2026) 31%", ["Arabic"], "ar"),
  item("arabic-diacritics", "السَّلَامُ عَلَيْكُمْ", ["Arabic"], "ar"),
  item("latin-kerning", "AVATAR To WA Yo TÁ AVo", ["Garamond"]),
  ...["Garamond", "Lora", "Playfair"].map((face) =>
    item("latin-ligatures-" + face, "office affinity ffi fi ff fl efficient", [face]),
  ),
  item("latin-tracked", "office affinity AVATAR", ["Garamond"], "en-US", { tracking: 1.25 }),
  item("latin-bold-optical", "WAVES office final", ["Inter"], "en-US", { weight: 700, size: 27.5 }),
  item("latin-fractional-tracking", "office AV fi", ["Inter"], "en-US", { size: 19.27, tracking: -0.37 }),
  item("vietnamese-nfc", "lợi nhuận quý", ["Narrow"]),
  item("vietnamese-nfd", "lợi nhuận quý".normalize("NFD"), ["Narrow"]),
  ...["Inter", "Lora", "Geist", "Playfair"].map((face) =>
    item("vietnamese-nfd-" + face, "Doanh thu quý 3 tăng, lợi nhuận ổn định".normalize("NFD"), [face]),
  ),
  item("stacked-marks", "q̣̂ x̌̃ ɛ̃́ ŋ̀ a̧̋ o̤̓", ["Narrow"]),
  item("greek-nfd", "ἀγάπη ἐλπίς ὦ".normalize("NFD"), ["Serif"], "el"),
  item("hebrew-niqqud", "שָׁלוֹם עוֹלָם 12% (2026)", ["Hebrew"], "he"),
  item("cjk-punctuation", "収益が増えた。「利益」、重要です！", ["JP"], "ja"),
  item("cjk-variation-selector", "葛\u{E0100} 収益", ["JP"], "ja"),
  item("han-fallback", "Revenue 収益 not lost", ["Narrow", "JP"]),
  item("hangul-nfc", "매출 증가 보고서", ["KR"], "ko"),
  item("hangul-nfd", "매출 증가 보고서".normalize("NFD"), ["KR"], "ko"),
  item("hangul-old-jamo", "ᄒᆞᆫᄀᆞᆯ 옛한글", ["KR"], "ko"),
  item("thai-dictionary", "กำไรเพิ่มขึ้นที่สำคัญ", ["Thai"], "th"),
  item("devanagari", "लाभ में वृद्धि क्षेत्र", ["Devanagari"], "hi"),
  item("myanmar", "မြန်မာဘာသာ စမ်းသပ်ချက်", ["Myanmar"], "my"),
  item("balinese", "ᬪᬵᬱᬩᬮᬶ ᬲᬸᬓ᭄ᬱ᭄ᬫ", ["Balinese"], "ban"),
  item("javanese", "ꦧꦱꦗꦮ ꦱꦸꦒꦼꦁ", ["Javanese"], "jv"),
  item("sundanese", "ᮘᮞ ᮞᮥᮔ᮪ᮓ", ["Sundanese"], "su"),
  item("math-vs1", "⊊︀ ⊋︀", ["Math"]),
  ...["Emoji", "Geist"].flatMap((face) =>
    Object.entries(emoji).map(([id, char]) => item("emoji-" + id + "-" + face, "Team " + char + " ok", [face])),
  ),
  item("symbols-twin", "AB ✈︎ ✈️ ©︎ ©️", ["Narrow", "Symbols"]),
  item("mixed-fallback", "Revenue 収益 🚀 نمت", ["JP", "Arabic"]),
  {
    id: "mixed-styles",
    lang: "en-US",
    runs: [
      { text: "Q3 AV", faces: ["NarrowBold", "Geist"], size: 33, weight: 700 },
      { text: " 収益 ", faces: ["JP", "Geist"], size: 37, weight: 400 },
      { text: "نمت الإيرادات", faces: ["Arabic", "Geist"], size: 41, weight: 500 },
      { text: " 👩‍💻", faces: ["Geist", "Emoji"], size: 39, weight: 400 },
    ],
  },
  item("punctuation-glue", "North\u00A0America (profit) 39% a-b soft\u00ADhyphen zero\u200Bwidth", ["Lora"]),
  item("explicit-break", "First line\n\nNext line.", ["Geist"]),
  {
    id: "production-vs15-Emoji",
    lang: "en-US",
    runs: [{ text: "Team ❤︎ ok", faces: ["Emoji", "Geist"], size: 44, weight: 400 }],
  },
  {
    id: "production-vs15-smile-Emoji",
    lang: "en-US",
    runs: [{ text: "Team ☺︎ ok", faces: ["Emoji", "Geist"], size: 44, weight: 400 }],
  },
  {
    id: "production-zwj-Geist",
    lang: "en-US",
    runs: [{ text: "Team 👩‍💻 ok", faces: ["Geist"], size: 44, weight: 400 }],
  },
  item("unserved-geist-han", "Revenue 収益", ["Geist"]),
  item("unserved-geist-arabic", "Revenue نمت الإيرادات", ["Geist"]),
]

const vietnamese = "Doanh thu quý 3 tăng, biên lợi nhuận giữ ở mức 31%"

corpus.push(
  item("1625-estimate-first", "Wiggle waves AVAVA", ["Narrow"], "en-US", { faces: ["Narrow", "Geist"] }),
  item("1625-estimate-second", "illi MMMM ... WWW", ["Narrow"], "en-US", { faces: ["Narrow", "Geist"] }),
  item("1625-missing-glyph", vietnamese, ["Narrow"], "vi", {
    faces: ["Narrow", "Geist"],
    legacyCanvasFaces: ["Narrow"],
  }),
  item("1625-geist-offline", vietnamese, ["Narrow"], "vi", { faces: ["Narrow"] }),
  item("1625-missing-glyph-mixed", "Doanh thu quý 3 tăng, lợi nhuận giữ ở mức 31%", ["Narrow"], "vi", {
    faces: ["Narrow", "Geist"],
    legacyCanvasFaces: ["Narrow"],
  }),
  item("1625-missing-family", "Unlisted typeface elsewhere", ["Geist"], "en-US", {
    faces: ["Geist"],
    local: "AirDesign Audit Missing Face",
  }),
  item("1625-emoji-zwj", "Team 👩‍💻👨‍👩‍👧 ok", ["Emoji"], "en-US", { faces: ["Emoji", "Geist"] }),
  item("1625-local-face", "Wide words in a locally installed font", ["Geist"], "en-US", {
    faces: ["Geist"],
    local: "DejaVu Serif",
  }),
)

const importSamples = [
  [
    "nasa-earth-gram-rra",
    "Aptos",
    "to 9.943.  This will weight data points up to and including 9.943 at 100%.",
    1509.86,
    1442.672,
  ],
  ["nasa-hlpw4-turbulence", "Euclid", "Grids from the TMR website were", 695.75, 667.172],
  ["nasa-hlpw4-turbulence", "Symbol", "a", 24.707, 24.25],
  ["nasa-ixpe-science-ops", "Menlo", "https://ixpe.msfc.nasa.gov/for_scientists/weekly.html", 1102.41, 1079.594],
  ["nasa-jwst-optics-lessons", "Aptos", "lessons learned talks are online (video and charts):", 1058.23, 1012.969],
  ["nasa-roman-thermal-runtime", "Symbol", "100%", 116.617, 110.531],
  ["doe-heat-pumps", "Abadi", "Cold Climate Air Source Heat Pump Sizing and Design Training", 1302.58, 1255.156],
]

for (const [name, font, text] of importSamples) {
  corpus.push(
    item(`1625-${name}-${font}`, text, ["Geist"], "en-US", {
      local: font,
      faces: ["Geist"],
      legacyCanvasFaces: [],
    }),
  )
}

const arabicWidths = [
  ["mixed", "نمت الإيرادات بنسبة 12%", 459.272, 458.594],
  ["repeated-lam", "للللل", 82.5],
  ["joining", "اللهم", 76.692],
  ["bismillah", "بسم الله الرحمن الرحيم", 390.28],
]
for (const [name, text] of arabicWidths) {
  corpus.push(item(`1625-arabic-${name}`, text, ["Arabic"], "ar", { faces: ["Arabic", "Geist"] }))
}

export const historical = {
  ...Object.fromEntries(
    importSamples.map(([name, font, , legacy, native]) => [
      `1625-${name}-${font}`,
      { model: "canvas", legacy, native },
    ]),
  ),
  ...Object.fromEntries(
    arabicWidths.map(([name, , legacy, native]) => [`1625-arabic-${name}`, { model: "primary", legacy, native }]),
  ),
  "1625-estimate-first": { model: "estimate", legacy: 435.6, native: 340.391 },
  "1625-estimate-second": { model: "estimate", legacy: 411.4, native: 314.641 },
  "1625-missing-glyph": { model: "first", legacy: 788.412, native: 863.875, browserLegacy: 869.988 },
  "1625-geist-offline": { model: "canvas", legacy: 874.822, native: 874.828 },
  "1625-missing-glyph-mixed": { model: "canvas", legacy: 791.742, native: 785.625 },
  "1625-local-face": { model: "stack", legacy: 733.92, native: 825.719 },
  "vietnamese-nfd": { model: "stack", legacy: 214.672, native: 224 },
  "arabic-joining": { model: "primary", legacy: 399.565, native: 403.406 },
  "1625-emoji-zwj": { model: "stack", legacy: 542.512, native: 378.156 },
  "hangul-nfc": { model: "cluster", legacy: 303.073, native: 308 },
  "hangul-nfd": { model: "cluster", legacy: 303.073, native: 308 },
  "hangul-old-jamo": { model: "cluster", legacy: 212.242, native: 214.72 },
  "production-vs15-Emoji": { model: "cluster", legacy: 323.387, native: 305.469 },
  "production-vs15-smile-Emoji": { model: "cluster", legacy: 323.387, native: 305.035 },
}

export const systemFaceReasons = {
  "1625-geist-offline": "With Geist withheld, native fallback supplies the Vietnamese glyphs that Narrow lacks.",
  "1625-local-face": "The historical browser stack started with a locally installed DejaVu Serif.",
  "stacked-marks": "Some combining marks have no served face for the whole cluster.",
  "production-vs15-Emoji": "The heart requests text presentation and the original stack has no served text heart.",
  "production-vs15-smile-Emoji": "Chromium can select a system text face when it honors the presentation selector.",
  "production-zwj-Geist": "The original stack lacks an emoji face.",
  "unserved-geist-arabic": "Geist lacks the Arabic letters.",
  "unserved-geist-han": "Geist lacks the Han characters.",
}
