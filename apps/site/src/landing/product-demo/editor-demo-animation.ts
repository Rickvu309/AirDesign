type DemoMotion = "fade" | "rise" | "reveal-up" | "draw";

interface DemoCue {
  part: string;
  startMs: number;
  durationMs: number;
  motion: DemoMotion;
  exitStartMs?: number;
}

interface DemoEasings {
  micro: string;
  panel: string;
}

interface CursorStop {
  ms: number;
  x: number;
  y: number;
}

interface OpacityPoint {
  ms: number;
  opacity: number;
}

const loopMs = 18000;
const resetStartMs = 16800;
const resetDurationMs = 320;
const resetEndMs = resetStartMs + resetDurationMs;
const visibleInViewThreshold = 0.35;

const composerExpandMs = 1400;
const composerCollapseMs = 6160;
const composerMotionMs = 280;
const composerFadeEndMs = composerCollapseMs + composerMotionMs + 120;
const composerShortClip = "inset(83.25px -2px -2px -2px round 11.89px)";
const composerTallClip = "inset(-2px -2px -2px -2px round 13.89px)";

const caretShowMs = 2420;
const typingStartMs = 2500;
const typingWindowMs = 3050;
const typingGapPattern = [34, 46, 28, 52, 38, 30, 44];
const typingPauseCharacters = new Set([" ", ".", ",", "-"]);
const typingPauseExtraMs = 26;

const agentStartMs = 6300;
const titleSwapStartMs = agentStartMs + 3000;
const titleSwapOutMs = 200;
const draftFrameStartMs = agentStartMs + 2200;
const columnStartsMs = [3500, 3610, 3710, 3795, 3865].map((ms) => agentStartMs + ms);
const segmentOffsetsMs = [0, 90, 180];
const columnGrowMs = 420;
const tableRowStartsMs = [5620, 5740, 5840].map((ms) => agentStartMs + ms);

const glowSettleStartMs = agentStartMs + 6350;
const glowSettleDurationMs = 600;
const blankStageFadeMs = 500;
const glowSpinMs = 3200;

const logReadDelayMs = 300;
const logSummaryDelayMs = 800;
const logBuiltDelayMs = 1750;
const logBuildingDelayMs = 2150;
const streamWordGapPattern = [70, 55, 85, 60, 95, 50, 75];
const streamWordDurationMs = 200;
const shimmerSweepMs = 950;
const shimmerWidth = 72;
const shimmerRepeatMs = 1150;
const sparkMoveMs = 280;
const sparkMoveLeadMs = 90;
const sparkSpinMs = 3000;
const sparkSlots = [
  { delayMs: logReadDelayMs, y: 25.9 },
  { delayMs: logSummaryDelayMs, y: 73.12 },
  { delayMs: logBuiltDelayMs, y: 99.02 },
  { delayMs: logBuildingDelayMs, y: 124.9 },
];

const cursorTip = 4;
const plusButton = { x: 975.5, y: 753 };
const promptField = { x: 1040, y: 690 };
const typingRestSpot = { x: 1172, y: 626 };
const sendButton = { x: 1219, y: 753 };
const cursorStops: CursorStop[] = [
  { ms: 0, x: 600, y: 500 },
  { ms: 700, x: 600, y: 500 },
  { ms: 1300, ...plusButton },
  { ms: 1900, ...plusButton },
  { ms: 2340, ...promptField },
  { ms: 2480, ...promptField },
  { ms: 2950, ...typingRestSpot },
  { ms: 5650, ...typingRestSpot },
  { ms: 6050, ...sendButton },
  { ms: 6350, ...sendButton },
  { ms: 6950, x: 1120, y: 560 },
];
const cursorPressesMs = [1320, 2360, 6080];
const cursorPressDownMs = 70;
const cursorPressUpMs = 110;
const cursorPressScale = 0.86;
const cursorOpacityPoints: OpacityPoint[] = [
  { ms: 0, opacity: 0 },
  { ms: 300, opacity: 0 },
  { ms: 500, opacity: 1 },
  { ms: 7000, opacity: 1 },
  { ms: 7200, opacity: 0 },
  { ms: loopMs, opacity: 0 },
];

const hiddenFrames: Record<DemoMotion, Keyframe> = {
  fade: { opacity: 0 },
  rise: { opacity: 0, transform: "translateY(4px)" },
  "reveal-up": { opacity: 1, clipPath: "inset(100% 0% 0% 0%)" },
  draw: { opacity: 1, clipPath: "inset(-4px 100% -4px -4px)" },
};

const shownFrames: Record<DemoMotion, Keyframe> = {
  fade: { opacity: 1 },
  rise: { opacity: 1, transform: "translateY(0)" },
  "reveal-up": { opacity: 1, clipPath: "inset(0% 0% 0% 0%)" },
  draw: { opacity: 1, clipPath: "inset(-4px -4px -4px -4px)" },
};

function agentCue(part: string, delayMs: number, durationMs: number, motion: DemoMotion): DemoCue {
  return { part, startMs: agentStartMs + delayMs, durationMs, motion };
}

const cues: DemoCue[] = [
  { part: "user-message", startMs: composerCollapseMs, durationMs: 300, motion: "rise" },
  agentCue("thread-title", 200, 300, "fade"),
  agentCue("deck-title", 300, 300, "fade"),
  agentCue("log-read", logReadDelayMs, 260, "rise"),
  agentCue("strip-opening", logBuiltDelayMs, 240, "fade"),
  agentCue("strip-slide-1", logBuiltDelayMs, 300, "rise"),
  agentCue("strip-slide-2", logBuiltDelayMs + 70, 300, "rise"),
  agentCue("log-built", logBuiltDelayMs, 260, "rise"),
  agentCue("strip-performance", logBuildingDelayMs, 240, "fade"),
  agentCue("strip-slide-3", logBuildingDelayMs, 300, "rise"),
  agentCue("log-building", logBuildingDelayMs, 260, "rise"),
  agentCue("slide-number", logBuildingDelayMs, 240, "fade"),
  agentCue("strip-queued", logBuildingDelayMs + 90, 300, "fade"),
  { part: "slide-run-glow", startMs: agentStartMs, durationMs: blankStageFadeMs, motion: "fade", exitStartMs: glowSettleStartMs },
  { part: "draft-frame", startMs: draftFrameStartMs, durationMs: 300, motion: "fade" },
  { part: "answer-title", startMs: titleSwapStartMs, durationMs: 300, motion: "rise" },
  { part: "unit", startMs: titleSwapStartMs + 80, durationMs: 300, motion: "fade" },
  { part: "legend", startMs: columnStartsMs[0], durationMs: 300, motion: "fade" },
  ...columnStartsMs.flatMap((columnStartMs, column): DemoCue[] => [
    ...segmentOffsetsMs.map((offsetMs, segment): DemoCue => ({
      part: `bar-${column}-${segment}`,
      startMs: columnStartMs + offsetMs,
      durationMs: columnGrowMs,
      motion: "reveal-up",
    })),
    { part: `growth-${column}`, startMs: columnStartMs, durationMs: 240, motion: "fade" },
    { part: `total-${column}`, startMs: columnStartMs + columnGrowMs, durationMs: 240, motion: "rise" },
  ]),
  agentCue("cagr-line", 4600, 700, "draw"),
  agentCue("cagr-label", 4900, 280, "rise"),
  agentCue("cagr-head", 5240, 160, "fade"),
  agentCue("cagr-highlight", 5300, 260, "fade"),
  agentCue("table-head", 5500, 260, "fade"),
  ...tableRowStartsMs.map((startMs, row): DemoCue => ({
    part: `table-row-${row}`,
    startMs,
    durationMs: 280,
    motion: "rise",
  })),
  agentCue("source", 6050, 300, "fade"),
];

function offsetAt(ms: number): number {
  return ms / loopMs;
}

function cueKeyframes(cue: DemoCue, easings: DemoEasings): Keyframe[] {
  const hidden = hiddenFrames[cue.motion];
  const shown = shownFrames[cue.motion];
  const enterEasing = cue.motion === "draw" ? easings.panel : easings.micro;
  const exitStartMs = cue.exitStartMs ?? resetStartMs;
  const exitEndMs = cue.exitStartMs === undefined ? resetEndMs : cue.exitStartMs + glowSettleDurationMs;
  return [
    { ...hidden, offset: 0 },
    { ...hidden, offset: offsetAt(cue.startMs), easing: enterEasing },
    { ...shown, offset: offsetAt(cue.startMs + cue.durationMs) },
    { ...shown, offset: offsetAt(exitStartMs), easing: easings.micro },
    { ...shown, opacity: 0, offset: offsetAt(exitEndMs) },
    { ...hidden, opacity: 0, offset: offsetAt(exitEndMs + 1) },
    { ...hidden, offset: 1 },
  ];
}

function opacityKeyframes(points: OpacityPoint[], easing: string): Keyframe[] {
  return points.map(({ ms, opacity }) => ({ opacity, offset: offsetAt(ms), easing }));
}

function draftTitleKeyframes(easings: DemoEasings): Keyframe[] {
  return opacityKeyframes(
    [
      { ms: 0, opacity: 0 },
      { ms: draftFrameStartMs, opacity: 0 },
      { ms: draftFrameStartMs + 300, opacity: 1 },
      { ms: titleSwapStartMs, opacity: 1 },
      { ms: titleSwapStartMs + titleSwapOutMs, opacity: 0 },
      { ms: loopMs, opacity: 0 },
    ],
    easings.micro,
  );
}

function composerPlaceholderKeyframes(easings: DemoEasings): Keyframe[] {
  return opacityKeyframes(
    [
      { ms: 0, opacity: 1 },
      { ms: caretShowMs, opacity: 1 },
      { ms: caretShowMs + 120, opacity: 0 },
      { ms: resetStartMs, opacity: 0 },
      { ms: resetEndMs, opacity: 1 },
      { ms: loopMs, opacity: 1 },
    ],
    easings.micro,
  );
}

function composerDraftKeyframes(easings: DemoEasings): Keyframe[] {
  return [
    { opacity: 1, clipPath: composerShortClip, offset: 0 },
    { opacity: 1, clipPath: composerShortClip, offset: offsetAt(composerExpandMs), easing: easings.panel },
    { opacity: 1, clipPath: composerTallClip, offset: offsetAt(composerExpandMs + composerMotionMs) },
    { opacity: 1, clipPath: composerTallClip, offset: offsetAt(composerCollapseMs), easing: easings.panel },
    { opacity: 1, clipPath: composerShortClip, offset: offsetAt(composerCollapseMs + composerMotionMs) },
    { opacity: 0, clipPath: composerShortClip, offset: offsetAt(composerFadeEndMs) },
    { opacity: 0, clipPath: composerShortClip, offset: offsetAt(resetStartMs), easing: easings.micro },
    { opacity: 1, clipPath: composerShortClip, offset: offsetAt(resetEndMs) },
    { opacity: 1, clipPath: composerShortClip, offset: 1 },
  ];
}

function cursorMoveKeyframes(easings: DemoEasings): Keyframe[] {
  const lastStop = cursorStops[cursorStops.length - 1];
  return [...cursorStops, { ...lastStop, ms: loopMs }].map(({ ms, x, y }) => ({
    transform: `translate(${x - cursorTip}px, ${y - cursorTip}px)`,
    offset: offsetAt(ms),
    easing: easings.panel,
  }));
}

function cursorPressKeyframes(easings: DemoEasings): Keyframe[] {
  const pressFrames = cursorPressesMs.flatMap((pressMs): Keyframe[] => [
    { transform: "scale(1)", offset: offsetAt(pressMs), easing: easings.micro },
    { transform: `scale(${cursorPressScale})`, offset: offsetAt(pressMs + cursorPressDownMs), easing: easings.micro },
    { transform: "scale(1)", offset: offsetAt(pressMs + cursorPressDownMs + cursorPressUpMs) },
  ]);
  return [{ transform: "scale(1)", offset: 0 }, ...pressFrames, { transform: "scale(1)", offset: 1 }];
}

function typingTimesMs(characters: string[]): number[] {
  const gaps = characters.map((character, index) => {
    const gap = typingGapPattern[index % typingGapPattern.length];
    return typingPauseCharacters.has(character) ? gap + typingPauseExtraMs : gap;
  });
  const scale = typingWindowMs / gaps.reduce((total, gap) => total + gap, 0);
  let elapsedMs = 0;
  return gaps.map((gap) => {
    elapsedMs += gap * scale;
    return typingStartMs + elapsedMs;
  });
}

function splitIntoCharacters(typing: HTMLElement): HTMLSpanElement[] {
  const characters = Array.from(typing.textContent ?? "");
  const spans = characters.map((character) => {
    const span = document.createElement("span");
    span.textContent = character;
    return span;
  });
  typing.replaceChildren(...spans);
  return spans;
}

function characterKeyframes(typedMs: number): Keyframe[] {
  return [
    { opacity: 0, offset: 0 },
    { opacity: 0, offset: offsetAt(typedMs), easing: "step-end" },
    { opacity: 1, offset: offsetAt(typedMs) },
    { opacity: 1, offset: offsetAt(composerCollapseMs + composerMotionMs), easing: "step-end" },
    { opacity: 0, offset: offsetAt(composerCollapseMs + composerMotionMs) },
    { opacity: 0, offset: 1 },
  ];
}

function caretKeyframes(spans: HTMLSpanElement[], typedTimesMs: number[]): Keyframe[] {
  const lastSpan = spans[spans.length - 1];
  const caretAt = (span: HTMLSpanElement, side: "start" | "end") =>
    `translate(${span.offsetLeft + (side === "end" ? span.offsetWidth : 0)}px, ${span.offsetTop}px)`;
  const startTransform = caretAt(spans[0], "start");
  const endTransform = caretAt(lastSpan, "end");
  return [
    { opacity: 0, transform: startTransform, offset: 0 },
    { opacity: 0, transform: startTransform, offset: offsetAt(caretShowMs), easing: "step-end" },
    { opacity: 1, transform: startTransform, offset: offsetAt(caretShowMs) },
    ...spans.map((span, index): Keyframe => ({
      opacity: 1,
      transform: caretAt(span, "end"),
      offset: offsetAt(typedTimesMs[index]),
      easing: "step-end",
    })),
    { opacity: 1, transform: endTransform, offset: offsetAt(composerCollapseMs), easing: "step-end" },
    { opacity: 0, transform: endTransform, offset: offsetAt(composerCollapseMs) },
    { opacity: 0, transform: endTransform, offset: 1 },
  ];
}

function blankStageKeyframes(easings: DemoEasings): Keyframe[] {
  return opacityKeyframes(
    [
      { ms: 0, opacity: 1 },
      { ms: agentStartMs, opacity: 1 },
      { ms: agentStartMs + blankStageFadeMs, opacity: 0 },
      { ms: resetStartMs, opacity: 0 },
      { ms: resetEndMs, opacity: 1 },
      { ms: loopMs, opacity: 1 },
    ],
    easings.micro,
  );
}

function splitIntoWords(element: Element): HTMLSpanElement[] {
  const words = (element.textContent ?? "").trim().split(/\s+/);
  const spans = words.map((word) => {
    const span = document.createElement("span");
    span.textContent = word;
    span.style.display = "inline-block";
    return span;
  });
  element.replaceChildren(...spans.flatMap((span, index) => (index === 0 ? [span] : [" ", span])));
  return spans;
}

function animateStreamedReply(demo: Element, easings: DemoEasings): Animation[] {
  const reply = demo.querySelector('[data-demo-part="log-summary"]');
  if (!reply) {
    return [];
  }
  let startMs = agentStartMs + logSummaryDelayMs;
  return splitIntoWords(reply).map((word, index) => {
    const cue: DemoCue = { part: "log-summary", startMs, durationMs: streamWordDurationMs, motion: "rise" };
    startMs += streamWordGapPattern[index % streamWordGapPattern.length];
    return startPaused(word, cueKeyframes(cue, easings));
  });
}

function shimmerKeyframes(sweepStartsMs: number[], travel: number): Keyframe[] {
  const before = `translateX(${-shimmerWidth}px)`;
  const after = `translateX(${travel}px)`;
  return [
    { transform: before, offset: 0 },
    ...sweepStartsMs.flatMap((startMs): Keyframe[] => [
      { transform: before, offset: offsetAt(startMs) },
      { transform: after, offset: offsetAt(startMs + shimmerSweepMs) },
      { transform: before, offset: offsetAt(startMs + shimmerSweepMs + 1) },
    ]),
    { transform: before, offset: 1 },
  ];
}

function buildingShimmerStartsMs(): number[] {
  const firstSweepMs = agentStartMs + logBuildingDelayMs + 260;
  const count = Math.floor((glowSettleStartMs - firstSweepMs) / shimmerRepeatMs);
  return Array.from({ length: count }, (_, index) => firstSweepMs + index * shimmerRepeatMs);
}

function animateShimmer(demo: Element, part: string, sweepStartsMs: number[]): Animation[] {
  const line = demo.querySelector<HTMLElement>(`[data-demo-part="${part}"]`);
  if (!line) {
    return [];
  }
  const travel = Math.max(...Array.from(line.children, (child) => (child as HTMLElement).offsetLeft + (child as HTMLElement).offsetWidth)) + 12;
  const band = document.createElement("span");
  band.style.cssText = `position: absolute; top: 0; bottom: 0; left: 0; width: ${shimmerWidth}px; background-image: linear-gradient(90deg, #ffffff00, #ffffffe0, #ffffff00); transform: translateX(${-shimmerWidth}px);`;
  line.style.overflow = "hidden";
  line.append(band);
  return [startPaused(band, shimmerKeyframes(sweepStartsMs, travel))];
}

function sparkMoveKeyframes(easings: DemoEasings): Keyframe[] {
  const at = (y: number) => `translateY(${y}px)`;
  let currentY = 0;
  const moves = sparkSlots.flatMap(({ delayMs, y }): Keyframe[] => {
    const leaveMs = agentStartMs + delayMs - sparkMoveLeadMs;
    const frames: Keyframe[] = [
      { transform: at(currentY), offset: offsetAt(leaveMs), easing: easings.panel },
      { transform: at(y), offset: offsetAt(leaveMs + sparkMoveMs) },
    ];
    currentY = y;
    return frames;
  });
  return [{ transform: at(0), offset: 0 }, ...moves, { transform: at(currentY), offset: 1 }];
}

function sparkOpacityKeyframes(easings: DemoEasings): Keyframe[] {
  return opacityKeyframes(
    [
      { ms: 0, opacity: 0 },
      { ms: composerCollapseMs + 120, opacity: 0 },
      { ms: composerCollapseMs + 320, opacity: 1 },
      { ms: glowSettleStartMs, opacity: 1 },
      { ms: glowSettleStartMs + 240, opacity: 0 },
      { ms: loopMs, opacity: 0 },
    ],
    easings.micro,
  );
}

function spinPaused(element: Element, keyframes: Keyframe[], durationMs: number): Animation {
  const animation = element.animate(keyframes, { duration: durationMs, iterations: Infinity, easing: "linear" });
  animation.pause();
  return animation;
}

function animateAgentPresence(demo: Element, easings: DemoEasings): Animation[] {
  const sparkPulse: Keyframe[] = [
    { transform: "rotate(0deg) scale(0.82)" },
    { transform: "rotate(180deg) scale(1.1)" },
    { transform: "rotate(360deg) scale(0.82)" },
  ];
  const glowSpin: Keyframe[] = [{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }];
  return [
    ...animateAll(demo, "[data-demo-spark]", sparkMoveKeyframes(easings)),
    ...animateAll(demo, "[data-demo-spark]", sparkOpacityKeyframes(easings)),
    ...Array.from(demo.querySelectorAll("[data-demo-spark-spin]"), (spark) => spinPaused(spark, sparkPulse, sparkSpinMs)),
    ...Array.from(demo.querySelectorAll("[data-demo-glow-spin]"), (glow) => spinPaused(glow, glowSpin, glowSpinMs)),
    ...animateCue(demo, "blank-stage", blankStageKeyframes(easings)),
  ];
}

function readEasings(): DemoEasings {
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    micro: rootStyle.getPropertyValue("--ease-micro").trim(),
    panel: rootStyle.getPropertyValue("--ease-panel").trim(),
  };
}

function startPaused(element: Element, keyframes: Keyframe[]): Animation {
  const animation = element.animate(keyframes, { duration: loopMs, iterations: Infinity });
  animation.pause();
  return animation;
}

function animateAll(demo: Element, selector: string, keyframes: Keyframe[]): Animation[] {
  return Array.from(demo.querySelectorAll(selector), (element) => startPaused(element, keyframes));
}

function animateCue(demo: Element, part: string, keyframes: Keyframe[]): Animation[] {
  return animateAll(demo, `[data-demo-part="${part}"]`, keyframes);
}

function animateTyping(demo: Element): Animation[] {
  const typing = demo.querySelector<HTMLElement>("[data-demo-typing]");
  const caret = demo.querySelector("[data-demo-caret]");
  if (!typing || !caret) {
    return [];
  }
  const spans = splitIntoCharacters(typing);
  const typedTimesMs = typingTimesMs(spans.map((span) => span.textContent ?? ""));
  return [
    ...spans.map((span, index) => startPaused(span, characterKeyframes(typedTimesMs[index]))),
    startPaused(caret, caretKeyframes(spans, typedTimesMs)),
  ];
}

export async function playEditorDemoAnimation(demo: Element): Promise<void> {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  await document.fonts.ready;

  const easings = readEasings();
  const animations = [
    ...animateCue(demo, "draft-title", draftTitleKeyframes(easings)),
    ...animateCue(demo, "composer-draft", composerDraftKeyframes(easings)),
    ...animateCue(demo, "composer-placeholder", composerPlaceholderKeyframes(easings)),
    ...cues.flatMap((cue) => animateCue(demo, cue.part, cueKeyframes(cue, easings))),
    ...animateTyping(demo),
    ...animateStreamedReply(demo, easings),
    ...animateShimmer(demo, "log-read", [agentStartMs + logReadDelayMs + 120]),
    ...animateShimmer(demo, "log-built", [agentStartMs + logBuiltDelayMs + 120]),
    ...animateShimmer(demo, "log-building", buildingShimmerStartsMs()),
    ...animateAgentPresence(demo, easings),
    ...animateAll(demo, "[data-demo-cursor]", cursorMoveKeyframes(easings)),
    ...animateAll(demo, "[data-demo-cursor]", opacityKeyframes(cursorOpacityPoints, "linear")),
    ...animateAll(demo, "[data-demo-cursor-press]", cursorPressKeyframes(easings)),
  ];

  new IntersectionObserver(
    ([entry]) => {
      animations.forEach((animation) => (entry.isIntersecting ? animation.play() : animation.pause()));
    },
    { threshold: visibleInViewThreshold },
  ).observe(demo);
}
