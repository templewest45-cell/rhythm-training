import type {
  BeatCount,
  Difficulty,
  EvaluationSummary,
  FeedbackMessage,
  InputMode,
  NoteValue,
  PatternAction,
  PatternStep,
  TeacherSettings,
  TimingCategory,
} from "../types";

const STORAGE_KEY = "rhythm-dojo-settings";
const DEFAULT_ACTIONS: PatternAction[] = ["clap", "rest", "step", "rest"];

const defaultNoteForAction = (action: PatternAction): NoteValue =>
  action === "rest" ? "rest" : "quarter";

export const createDefaultPattern = (beatsPerBar: BeatCount): PatternStep[] =>
  Array.from({ length: beatsPerBar }, (_, index) => {
    const action = DEFAULT_ACTIONS[index % DEFAULT_ACTIONS.length];
    return {
      id: index,
      action,
      note: defaultNoteForAction(action),
    };
  });

export const defaultSettings: TeacherSettings = {
  bpm: 92,
  beatsPerBar: 4,
  loops: 2,
  inputMode: "both",
  difficulty: "easy",
  showRhythmGuide: true,
  soundVolume: 1.2,
  clapThreshold: 0.09,
  motionThreshold: 0.08,
  pattern: createDefaultPattern(4),
};

const normalizeAction = (value: unknown): PatternAction => {
  if (value === "clap" || value === "step" || value === "rest") {
    return value;
  }
  return "rest";
};

const normalizeNote = (value: unknown, action: PatternAction): NoteValue => {
  if (value === "quarter" || value === "eighthPair" || value === "half" || value === "rest") {
    return value;
  }
  return defaultNoteForAction(action);
};

const normalizeBeatCount = (value: unknown): BeatCount => {
  if (value === 2 || value === 3 || value === 4 || value === 8) {
    return value;
  }
  return 4;
};

export const loadSettings = (): TeacherSettings => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<TeacherSettings>;
    const beatsPerBar = normalizeBeatCount(parsed.beatsPerBar);
    const pattern = Array.isArray(parsed.pattern)
      ? parsed.pattern.slice(0, beatsPerBar).map((step, index) => {
          const action = normalizeAction(step.action);
          return {
            id: index,
            action,
            note: normalizeNote(step.note, action),
          };
        })
      : createDefaultPattern(beatsPerBar);

    return {
      ...defaultSettings,
      ...parsed,
      beatsPerBar,
      clapThreshold:
        typeof parsed.clapThreshold === "number"
          ? Math.min(0.45, Math.max(0.03, parsed.clapThreshold))
          : defaultSettings.clapThreshold,
      soundVolume:
        typeof parsed.soundVolume === "number"
          ? Math.min(3, Math.max(0, parsed.soundVolume))
          : defaultSettings.soundVolume,
      pattern: pattern.length === beatsPerBar ? pattern : createDefaultPattern(beatsPerBar),
    };
  } catch {
    return defaultSettings;
  }
};

export const saveSettings = (settings: TeacherSettings) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const updatePatternLength = (pattern: PatternStep[], beatsPerBar: BeatCount): PatternStep[] =>
  Array.from({ length: beatsPerBar }, (_, index) => {
    const action = normalizeAction(pattern[index]?.action ?? DEFAULT_ACTIONS[index % DEFAULT_ACTIONS.length]);
    return {
      id: index,
      action,
      note: normalizeNote(pattern[index]?.note, action),
    };
  });

export const getJudgeWindows = (difficulty: Difficulty) => {
  switch (difficulty) {
    case "relaxed":
      return { onTime: 220, accept: 440 };
    case "normal":
      return { onTime: 160, accept: 320 };
    case "easy":
    default:
      return { onTime: 200, accept: 380 };
  }
};

export const feedbackForTiming = (category: TimingCategory | "miss"): FeedbackMessage => {
  switch (category) {
    case "onTime":
      return { text: "ぴったりです。", tone: "success" };
    case "early":
      return { text: "少しはやいです。", tone: "gentle" };
    case "late":
      return { text: "少しあとです。", tone: "gentle" };
    case "miss":
    default:
      return { text: "次の音に合わせましょう。", tone: "retry" };
  }
};

export const summarizeResults = (
  categories: TimingCategory[],
  totalExpected: number,
  totalCaptured: number,
): EvaluationSummary => {
  return categories.reduce<EvaluationSummary>(
    (summary, category) => {
      summary[category] += 1;
      return summary;
    },
    {
      onTime: 0,
      early: 0,
      late: 0,
      totalExpected,
      totalCaptured,
    },
  );
};

export const getPatternActionLabel = (action: PatternAction) => {
  switch (action) {
    case "clap":
      return "手拍子";
    case "step":
      return "足ぶみ";
    case "rest":
    default:
      return "休符";
  }
};

export const getPatternActionIcon = (action: PatternAction) => {
  switch (action) {
    case "clap":
      return "👏";
    case "step":
      return "🦶";
    case "rest":
    default:
      return "𝄽";
  }
};

export const getInputModeLabel = (mode: InputMode) => {
  switch (mode) {
    case "microphone":
      return "手拍子のみ";
    case "camera":
      return "足ぶみのみ";
    case "both":
    default:
      return "手拍子 + 足ぶみ";
  }
};

export const getDifficultyLabel = (difficulty: Difficulty) => {
  switch (difficulty) {
    case "easy":
      return "やさしい";
    case "normal":
      return "ふつう";
    case "relaxed":
    default:
      return "ゆったり";
  }
};

export const getNoteSymbol = (note: NoteValue) => {
  switch (note) {
    case "eighthPair":
      return "♪♪";
    case "half":
      return "𝅗𝅥";
    case "rest":
      return "𝄽";
    case "quarter":
    default:
      return "♩";
  }
};
