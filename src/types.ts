export type InputMode = "microphone" | "camera" | "both";

export type Difficulty = "easy" | "normal" | "relaxed";

export type PlayState = "idle" | "countdown" | "playing" | "finished";

export type PatternAction = "rest" | "clap" | "step";

export type NoteValue = "quarter" | "eighthPair" | "half" | "rest";

export type BeatCount = 2 | 3 | 4 | 8;

export type PatternStep = {
  id: number;
  action: PatternAction;
  note: NoteValue;
};

export type TeacherSettings = {
  bpm: number;
  beatsPerBar: BeatCount;
  loops: number;
  inputMode: InputMode;
  difficulty: Difficulty;
  showRhythmGuide: boolean;
  soundVolume: number;
  clapThreshold: number;
  motionThreshold: number;
  pattern: PatternStep[];
};

export type TimingCategory = "onTime" | "early" | "late";

export type FeedbackMessage = {
  text: string;
  tone: "success" | "gentle" | "retry";
};

export type EvaluationSummary = {
  onTime: number;
  early: number;
  late: number;
  totalExpected: number;
  totalCaptured: number;
};

export type HitEvent = {
  time: number;
  source: "microphone" | "camera";
};
