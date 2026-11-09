type FilmMotion = "fade" | "rise" | "reveal-up" | "draw";

interface FilmCue {
  part: string;
  startMs: number;
  durationMs: number;
  motion: FilmMotion;
}

interface FilmEasings {
  micro: string;
  panel: string;
}

const loopMs = 12000;
const resetStartMs = 10800;
const resetDurationMs = 320;
const resetEndMs = resetStartMs + resetDurationMs;
const titleSwapStartMs = 2000;
const titleSwapOutMs = 200;
const columnStartsMs = [2500, 2610, 2710, 2795, 2865];
const segmentOffsetsMs = [0, 90, 180];
const columnGrowMs = 420;
const tableRowStartsMs = [4620, 4740, 4840];
const visibleInViewThreshold = 0.35;

const hiddenFrames: Record<FilmMotion, Keyframe> = {
  fade: { opacity: 0 },
  rise: { opacity: 0, transform: "translateY(4px)" },
  "reveal-up": { opacity: 1, clipPath: "inset(100% 0% 0% 0%)" },
  draw: { opacity: 1, clipPath: "inset(-4px 100% -4px -4px)" },
};

const shownFrames: Record<FilmMotion, Keyframe> = {
  fade: { opacity: 1 },
  rise: { opacity: 1, transform: "translateY(0)" },
  "reveal-up": { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
  draw: { opacity: 1, clipPath: "inset(-4px -4px -4px -4px)" },
};

const cues: FilmCue[] = [
  { part: "log-read", startMs: 300, durationMs: 300, motion: "fade" },
  { part: "log-summary", startMs: 750, durationMs: 300, motion: "fade" },
  { part: "log-built", startMs: 1250, durationMs: 300, motion: "fade" },
  { part: "log-building", startMs: 1650, durationMs: 300, motion: "fade" },
  { part: "answer-title", startMs: titleSwapStartMs, durationMs: 300, motion: "rise" },
  { part: "unit", startMs: titleSwapStartMs + 80, durationMs: 300, motion: "fade" },
  { part: "legend", startMs: columnStartsMs[0], durationMs: 300, motion: "fade" },
  ...columnStartsMs.flatMap((columnStartMs, column): FilmCue[] => [
    ...segmentOffsetsMs.map((offsetMs, segment): FilmCue => ({
      part: `bar-${column}-${segment}`,
      startMs: columnStartMs + offsetMs,
      durationMs: columnGrowMs,
      motion: "reveal-up",
    })),
    { part: `growth-${column}`, startMs: columnStartMs, durationMs: 240, motion: "fade" },
    { part: `total-${column}`, startMs: columnStartMs + columnGrowMs, durationMs: 240, motion: "rise" },
  ]),
  { part: "cagr-line", startMs: 3600, durationMs: 700, motion: "draw" },
  { part: "cagr-label", startMs: 3900, durationMs: 280, motion: "rise" },
  { part: "cagr-head", startMs: 4240, durationMs: 160, motion: "fade" },
  { part: "cagr-highlight", startMs: 4300, durationMs: 260, motion: "fade" },
  { part: "table-head", startMs: 4500, durationMs: 260, motion: "fade" },
  ...tableRowStartsMs.map((startMs, row): FilmCue => ({
    part: `table-row-${row}`,
    startMs,
    durationMs: 280,
    motion: "rise",
  })),
  { part: "source", startMs: 5050, durationMs: 300, motion: "fade" },
];

function offsetAt(ms: number): number {
  return ms / loopMs;
}

function cueKeyframes(cue: FilmCue, easings: FilmEasings): Keyframe[] {
  const hidden = hiddenFrames[cue.motion];
  const shown = shownFrames[cue.motion];
  const enterEasing = cue.motion === "draw" ? easings.panel : easings.micro;
  return [
    { ...hidden, offset: 0 },
    { ...hidden, offset: offsetAt(cue.startMs), easing: enterEasing },
    { ...shown, offset: offsetAt(cue.startMs + cue.durationMs) },
    { ...shown, offset: offsetAt(resetStartMs), easing: easings.micro },
    { ...shown, opacity: 0, offset: offsetAt(resetEndMs) },
    { ...hidden, opacity: 0, offset: offsetAt(resetEndMs + 1) },
    { ...hidden, offset: 1 },
  ];
}

function draftTitleKeyframes(easings: FilmEasings): Keyframe[] {
  return [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: offsetAt(titleSwapStartMs), easing: easings.micro },
    { opacity: 0, offset: offsetAt(titleSwapStartMs + titleSwapOutMs) },
    { opacity: 0, offset: offsetAt(resetStartMs), easing: easings.micro },
    { opacity: 1, offset: offsetAt(resetEndMs) },
    { opacity: 1, offset: 1 },
  ];
}

function readEasings(): FilmEasings {
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    micro: rootStyle.getPropertyValue("--ease-micro").trim(),
    panel: rootStyle.getPropertyValue("--ease-panel").trim(),
  };
}

function animateParts(film: Element, part: string, keyframes: Keyframe[]): Animation[] {
  return Array.from(film.querySelectorAll(`[data-film-cue="${part}"]`), (element) => {
    const animation = element.animate(keyframes, { duration: loopMs, iterations: Infinity });
    animation.pause();
    return animation;
  });
}

export function playEditorRunFilm(film: Element): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const easings = readEasings();
  const animations = [
    ...animateParts(film, "draft-title", draftTitleKeyframes(easings)),
    ...cues.flatMap((cue) => animateParts(film, cue.part, cueKeyframes(cue, easings))),
  ];

  new IntersectionObserver(
    ([entry]) => {
      animations.forEach((animation) => (entry.isIntersecting ? animation.play() : animation.pause()));
    },
    { threshold: visibleInViewThreshold },
  ).observe(film);
}
