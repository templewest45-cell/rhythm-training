import type { BeatCount, NoteValue, PatternAction, PatternStep, TeacherSettings } from "../types";
import { defaultSettings } from "./rhythm";

type BasicRhythmLevel = {
  id: string;
  title: string;
  goals: string[];
  phrases: NoteValue[][];
};

export type BasicRhythmPreset = {
  meter: BeatCount;
  title: string;
  tagline: string;
  accent: string;
  goals: string[];
  levels: BasicRhythmLevel[];
};

const getActionSequence = (inputMode: TeacherSettings["inputMode"]) => {
  if (inputMode === "camera") {
    return ["step"] as const;
  }

  if (inputMode === "microphone") {
    return ["clap"] as const;
  }

  return ["clap", "step"] as const;
};

const createPattern = (notes: NoteValue[], inputMode: TeacherSettings["inputMode"]): PatternStep[] => {
  const actionSequence = getActionSequence(inputMode);
  let soundIndex = 0;

  return notes.map((note, index) => {
    if (note === "rest") {
      return {
        id: index,
        note,
        action: "rest" as PatternAction,
      };
    }

    const action = actionSequence[soundIndex % actionSequence.length];
    soundIndex += 1;

    return {
      id: index,
      note,
      action,
    };
  });
};

const noteBeatLength = (_note: NoteValue) => 1;

export const BASIC_RHYTHM_PRESETS: BasicRhythmPreset[] = [
  {
    meter: 2,
    title: "2拍子プリセット",
    tagline: "交互・進む・一定で続ける感覚を育てやすい拍子",
    accent: "強 弱 | 強 弱",
    goals: ["左右交互", "足踏み", "一定テンポ", "合わせる", "繰り返す"],
    levels: [
      {
        id: "2-1",
        title: "レベル1: 一定で打つ",
        goals: ["一定テンポ", "交互運動", "拍を感じる"],
        phrases: [
          ["quarter", "quarter"],
          ["quarter", "quarter", "quarter", "quarter"],
          ["quarter", "quarter", "quarter", "quarter", "quarter", "quarter"],
        ],
      },
      {
        id: "2-2",
        title: "レベル2: 休みを感じる",
        goals: ["待つ", "音がない時間を感じる", "次を待つ"],
        phrases: [
          ["quarter", "rest"],
          ["quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter"],
          ["quarter", "rest", "rest", "quarter"],
        ],
      },
      {
        id: "2-3",
        title: "レベル3: 交互を保つ",
        goals: ["左右の切り替え", "繰り返し", "パターン保持"],
        phrases: [
          ["quarter", "rest", "quarter", "quarter"],
          ["quarter", "quarter", "rest", "rest"],
          ["quarter", "rest", "quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter", "quarter", "rest"],
        ],
      },
      {
        id: "2-4",
        title: "レベル4: 短い音を入れる",
        goals: ["短い音", "細かいタイミング", "テンポ維持"],
        phrases: [
          ["eighthPair", "quarter"],
          ["quarter", "eighthPair"],
          ["eighthPair", "eighthPair"],
          ["eighthPair", "quarter", "quarter", "eighthPair"],
        ],
      },
      {
        id: "2-5",
        title: "レベル5: 長い流れ",
        goals: ["続ける", "流れを保つ", "長いまとまり"],
        phrases: [
          ["quarter", "rest", "quarter", "rest", "quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter", "quarter", "quarter", "rest", "quarter"],
          ["eighthPair", "quarter", "quarter", "eighthPair", "quarter", "rest", "quarter", "quarter"],
        ],
      },
    ],
  },
  {
    meter: 3,
    title: "3拍子プリセット",
    tagline: "揺れる・流れる・なめらかに続く感覚を育てやすい拍子",
    accent: "強 弱 弱 | 強 弱 弱",
    goals: ["揺れ", "身体表現", "流れ", "強弱感", "音楽に乗る"],
    levels: [
      {
        id: "3-1",
        title: "レベル1: 3拍を感じる",
        goals: ["3つのまとまり", "揺れ", "流れ"],
        phrases: [
          ["quarter", "quarter", "quarter"],
          ["quarter", "rest", "rest"],
          ["quarter", "quarter", "rest"],
          ["quarter", "rest", "quarter"],
        ],
      },
      {
        id: "3-2",
        title: "レベル2: 揺れを続ける",
        goals: ["流れ続ける", "拍を保つ", "身体を揺らす"],
        phrases: [
          ["quarter", "rest", "rest", "quarter", "rest", "rest"],
          ["quarter", "quarter", "rest", "quarter", "quarter", "rest"],
          ["quarter", "rest", "quarter", "quarter", "rest", "quarter"],
        ],
      },
      {
        id: "3-3",
        title: "レベル3: 流れを変える",
        goals: ["流れの変化", "強弱感", "模倣"],
        phrases: [
          ["quarter", "rest", "rest", "quarter", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter", "rest", "rest"],
          ["quarter", "rest", "quarter", "quarter", "quarter", "rest"],
        ],
      },
      {
        id: "3-4",
        title: "レベル4: 長い揺れ",
        goals: ["長い流れ", "継続", "身体表現"],
        phrases: [
          ["quarter", "rest", "rest", "quarter", "rest", "rest", "quarter", "rest", "rest"],
          ["quarter", "quarter", "rest", "quarter", "rest", "rest", "quarter", "quarter", "rest"],
          ["quarter", "rest", "quarter", "quarter", "quarter", "rest", "quarter", "rest", "quarter"],
        ],
      },
      {
        id: "3-5",
        title: "レベル5: 強弱を感じる",
        goals: ["強拍", "音楽らしい流れ", "表現"],
        phrases: [
          ["quarter", "rest", "rest"],
          ["quarter", "rest", "rest", "quarter", "rest", "rest"],
          ["quarter", "quarter", "rest", "quarter", "quarter", "rest"],
        ],
      },
    ],
  },
  {
    meter: 4,
    title: "4拍子プリセット",
    tagline: "安定・見通し・まとまりを感じやすい拍子",
    accent: "強 弱 中 弱 | 強 弱 中 弱",
    goals: ["待つ", "次を予測する", "集団で合わせる", "模倣する", "一定テンポを保つ"],
    levels: [
      {
        id: "4-1",
        title: "レベル1: 基本4拍",
        goals: ["拍を感じる", "一定テンポ", "見通し"],
        phrases: [
          ["quarter", "quarter", "quarter", "quarter"],
          ["quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter"],
        ],
      },
      {
        id: "4-2",
        title: "レベル2: 待つを入れる",
        goals: ["待つ", "次を予測する", "流れを保つ"],
        phrases: [
          ["quarter", "rest", "rest", "quarter"],
          ["quarter", "quarter", "rest", "rest"],
          ["quarter", "rest", "quarter", "quarter"],
          ["rest", "quarter", "rest", "quarter"],
        ],
      },
      {
        id: "4-3",
        title: "レベル3: まとまりを感じる",
        goals: ["4拍のまとまり", "繰り返し", "模倣"],
        phrases: [
          ["quarter", "rest", "quarter", "rest", "quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter", "quarter", "quarter", "rest", "quarter"],
          ["quarter", "rest", "rest", "quarter", "quarter", "rest", "rest", "quarter"],
        ],
      },
      {
        id: "4-4",
        title: "レベル4: 短い音を入れる",
        goals: ["細かいタイミング", "リズム変化", "注意保持"],
        phrases: [
          ["eighthPair", "quarter", "rest", "quarter"],
          ["quarter", "rest", "eighthPair", "quarter"],
          ["eighthPair", "eighthPair", "quarter", "rest"],
          ["quarter", "eighthPair", "quarter", "eighthPair"],
        ],
      },
      {
        id: "4-5",
        title: "レベル5: 長い音を感じる",
        goals: ["長短", "流れ", "音価理解"],
        phrases: [
          ["quarter", "rest", "quarter", "rest"],
          ["quarter", "rest", "rest", "quarter"],
          ["rest", "quarter", "rest", "quarter"],
          ["quarter", "rest", "quarter", "quarter"],
        ],
      },
      {
        id: "4-6",
        title: "レベル6: 強弱を感じる",
        goals: ["強拍", "拍のまとまり", "音楽表現"],
        phrases: [
          ["quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter"],
          ["quarter", "rest", "rest", "quarter"],
        ],
      },
    ],
  },
  {
    meter: 8,
    title: "8拍プリセット",
    tagline: "長い流れ・続ける・まとまりを保つ感覚を育てる",
    accent: "長い見通しを保ちながら続ける",
    goals: ["集中持続", "曲の流れ", "長い見通し", "継続"],
    levels: [
      {
        id: "8-1",
        title: "レベル1: 一定で続ける",
        goals: ["続ける", "一定テンポ", "長いまとまり"],
        phrases: [
          ["quarter", "quarter", "quarter", "quarter", "quarter", "quarter", "quarter", "quarter"],
          ["quarter", "rest", "quarter", "rest", "quarter", "rest", "quarter", "rest"],
        ],
      },
      {
        id: "8-2",
        title: "レベル2: 途中で待つ",
        goals: ["集中持続", "待つ", "流れを止めない"],
        phrases: [
          ["quarter", "quarter", "rest", "quarter", "quarter", "quarter", "rest", "quarter"],
          ["quarter", "rest", "rest", "quarter", "quarter", "rest", "rest", "quarter"],
          ["quarter", "quarter", "rest", "rest", "quarter", "quarter", "rest", "rest"],
        ],
      },
      {
        id: "8-3",
        title: "レベル3: 流れを維持する",
        goals: ["長いパターン保持", "模倣", "継続"],
        phrases: [
          ["quarter", "rest", "quarter", "quarter", "rest", "quarter", "rest", "quarter"],
          ["eighthPair", "quarter", "rest", "quarter", "quarter", "eighthPair", "rest", "quarter"],
          ["quarter", "rest", "eighthPair", "quarter", "quarter", "rest", "quarter", "quarter"],
        ],
      },
      {
        id: "8-4",
        title: "レベル4: 長短を含む",
        goals: ["音価理解", "長い流れ", "リズム変化"],
        phrases: [
          ["quarter", "rest", "quarter", "rest", "quarter", "rest", "quarter", "quarter"],
          ["rest", "quarter", "rest", "quarter", "quarter", "quarter", "rest", "rest"],
          ["quarter", "rest", "quarter", "quarter", "rest", "quarter", "quarter", "rest"],
        ],
      },
      {
        id: "8-5",
        title: "レベル5: 変化を維持する",
        goals: ["長い見通し", "強弱", "表現"],
        phrases: [
          ["quarter", "rest", "quarter", "rest", "quarter", "rest", "quarter", "rest"],
          ["quarter", "quarter", "rest", "quarter", "quarter", "rest", "rest", "quarter"],
          ["quarter", "eighthPair", "quarter", "rest", "quarter", "rest", "quarter", "quarter"],
        ],
      },
    ],
  },
];

export const getPresetByMeter = (meter: BeatCount) =>
  BASIC_RHYTHM_PRESETS.find((preset) => preset.meter === meter) ?? BASIC_RHYTHM_PRESETS[2];

export const createSettingsFromBasicLevel = (
  meter: BeatCount,
  levelId: string,
  currentSettings: TeacherSettings,
  phraseIndex = 0,
): TeacherSettings => {
  const preset = getPresetByMeter(meter);
  const level = preset.levels.find((item) => item.id === levelId) ?? preset.levels[0];
  const lessonPhrase = level.phrases[phraseIndex] ?? level.phrases[0];

  return {
    ...defaultSettings,
    ...currentSettings,
    beatsPerBar: meter,
    loops: 1,
    pattern: createPattern(lessonPhrase, currentSettings.inputMode),
  };
};

const validateBasicPreset = (meter: BeatCount, levelId: string, notes: NoteValue[]) => {
  const total = notes.reduce((sum, note) => sum + noteBeatLength(note), 0);
  if (total % meter !== 0) {
    throw new Error(`Invalid preset ${levelId}: expected multiples of ${meter} beats, got ${total}`);
  }
};

BASIC_RHYTHM_PRESETS.forEach((preset) => {
  preset.levels.forEach((level) => {
    level.phrases.forEach((phrase) => validateBasicPreset(preset.meter, level.id, phrase));
  });
});

export const formatPhrase = (phrase: NoteValue[], meter: BeatCount) =>
  phrase
    .map((note, index) => {
      const symbol =
        note === "quarter" ? "♩" : note === "eighthPair" ? "♪♪" : note === "half" ? "𝅗𝅥" : "𝄽";
      const divider = index > 0 && index % meter === 0 ? " | " : " ";
      return `${divider}${symbol}`;
    })
    .join("")
    .trim();
