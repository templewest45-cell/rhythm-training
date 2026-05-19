import { useEffect, useMemo, useRef, useState } from "react";
import { BeatGrid } from "./components/BeatGrid";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusCard } from "./components/StatusCard";
import { useCameraMotion } from "./hooks/useCameraMotion";
import { useMicrophoneBeat } from "./hooks/useMicrophoneBeat";
import type {
  BeatCount,
  FeedbackMessage,
  HitEvent,
  NoteValue,
  PatternAction,
  PatternStep,
  PlayState,
  TeacherSettings,
  TimingCategory,
} from "./types";
import {
  createSettingsFromBasicLevel,
  formatPhrase,
  getPresetByMeter,
  BASIC_RHYTHM_PRESETS,
} from "./utils/basicPresets";
import {
  createAttemptId,
  createPlayer,
  isBasicCleared,
  loadPlayers,
  savePlayers,
  type PlayerRecord,
  type RhythmAttempt,
} from "./utils/playerRecords";
import {
  defaultSettings,
  feedbackForTiming,
  getDifficultyLabel,
  getInputModeLabel,
  getJudgeWindows,
  getNoteSymbol,
  getPatternActionIcon,
  getPatternActionLabel,
  loadSettings,
  saveSettings,
  summarizeResults,
  updatePatternLength,
} from "./utils/rhythm";

type ExpectedHit = {
  index: number;
  action: Exclude<PatternAction, "rest">;
  time: number;
  matched: boolean;
};

type Screen = "modeSelect" | "basicPresetSelect" | "copyRhythm" | "lesson" | "result" | "records";
type TeacherScreen = "settings" | "scoreBuilder";
type BasicLessonSelection = {
  meter: BeatCount;
  levelId: string;
};
type CopyPoseAction = "clap" | "step" | "raise" | "wave" | "stop" | "rest";
type CopyPoseFrame =
  | "idle"
  | "clap_ready"
  | "clap_hit"
  | "step_left"
  | "step_right"
  | "raise"
  | "wave_left"
  | "wave_right"
  | "stop";
type CopyRhythmStep = {
  beat: number;
  pose: CopyPoseAction;
};
type CopyMode = "practice" | "performance";
type CopyPlayPhase = "idle" | "countdown" | "playing";
type CopyExpectedInput = "microphone" | "camera" | "none";
type CopyJudgement = "correct" | "miss";
type CopyResult = CopyRhythmStep & {
  expectedInput: CopyExpectedInput;
  judgement: CopyJudgement;
};
type CopyPerformanceBeat = {
  active: boolean;
  index: number;
  startTime: number;
  expectedInput: CopyExpectedInput;
  matched: boolean;
  wrongInput: boolean;
};

const BUILDER_ACTION_OPTIONS: PatternAction[] = ["clap", "step", "rest"];
const BUILDER_NOTE_OPTIONS: NoteValue[] = ["quarter", "eighthPair", "half", "rest"];
const COPY_RHYTHM_BASE_PATTERN: CopyPoseAction[] = [
  "clap",
  "clap",
  "rest",
  "step",
  "raise",
  "wave",
  "rest",
  "step",
];

const createCopyRhythmPattern = (meter: BeatCount, barCount: number): CopyRhythmStep[] => {
  const totalBeats = meter * barCount;

  return Array.from({ length: totalBeats }, (_, index) => ({
    beat: (index % meter) + 1,
    pose: COPY_RHYTHM_BASE_PATTERN[index % COPY_RHYTHM_BASE_PATTERN.length],
  }));
};

const COPY_POSE_SRC: Record<CopyPoseFrame, string> = {
  idle: "/poses/idle.png",
  clap_ready: "/poses/clap_ready.png",
  clap_hit: "/poses/clap_hit.png",
  step_left: "/poses/step_left.png",
  step_right: "/poses/step_right.png",
  raise: "/poses/raise.png",
  wave_left: "/poses/wave_left.png",
  wave_right: "/poses/wave_right.png",
  stop: "/poses/stop.png",
};

const getCopyPoseLabel = (pose: CopyPoseAction) => {
  switch (pose) {
    case "clap":
      return "手拍子";
    case "step":
      return "足ぶみ";
    case "raise":
      return "手を上げる";
    case "wave":
      return "手を振る";
    case "stop":
      return "止まる";
    case "rest":
    default:
      return "休み";
  }
};

const getCopyExpectedInput = (pose: CopyPoseAction): CopyExpectedInput => {
  if (pose === "clap") {
    return "microphone";
  }
  if (pose === "step" || pose === "raise" || pose === "wave") {
    return "camera";
  }
  return "none";
};

const getCopyExpectedLabel = (input: CopyExpectedInput) => {
  switch (input) {
    case "microphone":
      return "手拍子";
    case "camera":
      return "動き";
    case "none":
    default:
      return "止まる";
  }
};

const getAudioVolumeGain = (volume: number) => Math.max(0.001, volume * 4);

const getNoteLabel = (note: NoteValue) => {
  switch (note) {
    case "eighthPair":
      return "8分音符2つ";
    case "half":
      return "2分音符";
    case "rest":
      return "休符";
    case "quarter":
    default:
      return "4分音符";
  }
};

const inputSourceToAction = (source: HitEvent["source"]): Exclude<PatternAction, "rest"> =>
  source === "camera" ? "step" : "clap";

const MODE_CARDS = [
  {
    id: "basic-rhythm",
    title: "基礎リズムモード",
    tag: "1",
    icon: "🎵",
    learn: "拍感・一定テンポ・待つ",
    description: "拍子ごとのプリセットから始めて、基本のリズム感を育てます。",
  },
  {
    id: "copy-rhythm",
    title: "まねっこリズムモード",
    tag: "2",
    icon: "🪞",
    learn: "模倣・注視・タイミング合わせ",
    description: "見本の動きを見て、同じタイミングで動きをまねします。",
  },
  {
    id: "listen-copy",
    title: "きいてまねモード",
    tag: "3",
    icon: "👂",
    learn: "聴覚模倣・記憶・注意保持",
    description: "音だけを聞いて、お手本のリズムを再現します。",
  },
  {
    id: "music-play",
    title: "音楽あそびモード",
    tag: "4",
    icon: "🎶",
    learn: "音楽参加・身体活動・表現",
    description: "曲に合わせて、自由な身体表現で音楽に参加します。",
  },
  {
    id: "conductor",
    title: "指揮者モード",
    tag: "5",
    icon: "🪄",
    learn: "テンポ感・抑制・切り替え",
    description: "指揮の動きでテンポを保ち、最後の止めまで表現します。",
  },
  {
    id: "instrument",
    title: "楽器モード",
    tag: "6",
    icon: "🥁",
    learn: "楽器参加・音の反応・合奏導入",
    description: "タンバリンや太鼓など、音の出る教材を使ってリズム活動をします。",
  },
];
const AVAILABLE_MODE_IDS = new Set(["basic-rhythm", "copy-rhythm"]);

function App() {
  const [settings, setSettings] = useState<TeacherSettings>(() => loadSettings());
  const [builderSettings, setBuilderSettings] = useState<TeacherSettings>(() => settings);
  const [players, setPlayers] = useState<PlayerRecord[]>(() => loadPlayers());
  const [currentPlayerId, setCurrentPlayerId] = useState(() => loadPlayers()[0]?.id ?? "");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [screen, setScreen] = useState<Screen>("modeSelect");
  const [teacherScreen, setTeacherScreen] = useState<TeacherScreen | null>(null);
  const [selectedMode, setSelectedMode] = useState(MODE_CARDS[0]);
  const [selectedMeter, setSelectedMeter] = useState<BeatCount>(2);
  const [selectedLevelId, setSelectedLevelId] = useState("2-1");
  const [currentLessonSelection, setCurrentLessonSelection] = useState<BasicLessonSelection>({
    meter: 2,
    levelId: "2-1",
  });
  const [currentLessonPhraseIndex, setCurrentLessonPhraseIndex] = useState(0);
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [currentBeat, setCurrentBeat] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackMessage>({
    text: "モードを選んでレッスンを始めます。",
    tone: "gentle",
  });
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedHits, setCapturedHits] = useState<HitEvent[]>([]);
  const [judgedCategories, setJudgedCategories] = useState<TimingCategory[]>([]);
  const [missCount, setMissCount] = useState(0);
  const [copyIsPlaying, setCopyIsPlaying] = useState(false);
  const [copyMode, setCopyMode] = useState<CopyMode>("practice");
  const [copyPlayPhase, setCopyPlayPhase] = useState<CopyPlayPhase>("idle");
  const [copyCountdown, setCopyCountdown] = useState<number | null>(null);
  const [copyBeatIndex, setCopyBeatIndex] = useState(0);
  const [copyMeter, setCopyMeter] = useState<BeatCount>(4);
  const [copyBarCount, setCopyBarCount] = useState(1);
  const [copyPoseFrame, setCopyPoseFrame] = useState<CopyPoseFrame>("idle");
  const [copyResults, setCopyResults] = useState<CopyResult[]>([]);
  const [missingPoseFrames, setMissingPoseFrames] = useState<Partial<Record<CopyPoseFrame, boolean>>>({});

  const sessionStartRef = useRef(0);
  const sessionTimerRef = useRef<number | null>(null);
  const playStartTimeoutRef = useRef<number | null>(null);
  const expectedHitsRef = useRef<ExpectedHit[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const copyIntervalRef = useRef<number | null>(null);
  const copyTimeoutRefs = useRef<number[]>([]);
  const copyCountdownIntervalRef = useRef<number | null>(null);
  const copyCountdownTimeoutRef = useRef<number | null>(null);
  const copyStepSideRef = useRef<"left" | "right">("left");
  const copyWaveSideRef = useRef<"left" | "right">("left");
  const copyResultsRef = useRef<CopyResult[]>([]);
  const copyPerformanceBeatRef = useRef<CopyPerformanceBeat>({
    active: false,
    index: 0,
    startTime: 0,
    expectedInput: "none",
    matched: false,
    wrongInput: false,
  });

  const useMicrophone = settings.inputMode === "microphone" || settings.inputMode === "both";
  const useCamera = settings.inputMode === "camera" || settings.inputMode === "both";

  const microphone = useMicrophoneBeat({
    enabled: useMicrophone,
    threshold: settings.clapThreshold,
    onHit: (time) =>
      screen === "copyRhythm" && copyMode === "performance"
        ? handleCopyInput({ time, source: "microphone" })
        : handleInput({ time, source: "microphone" }),
  });

  const camera = useCameraMotion({
    enabled: useCamera,
    threshold: settings.motionThreshold,
    onMotion: (time) =>
      screen === "copyRhythm" && copyMode === "performance"
        ? handleCopyInput({ time, source: "camera" })
        : handleInput({ time, source: "camera" }),
  });

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    savePlayers(players);
  }, [players]);

  useEffect(() => {
    return () => {
      cleanupSession();
      cleanupCopyRhythm();
      microphone.stop();
      camera.stop();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      noiseBufferRef.current = null;
    };
  }, [camera.stop, microphone.stop]);

  useEffect(() => {
    (Object.entries(COPY_POSE_SRC) as [CopyPoseFrame, string][]).forEach(([frame, src]) => {
      const image = new Image();
      image.onload = () => {
        setMissingPoseFrames((current) => ({ ...current, [frame]: false }));
      };
      image.onerror = () => {
        setMissingPoseFrames((current) => ({ ...current, [frame]: true }));
      };
      image.src = src;
    });
  }, []);

  const judgeWindows = getJudgeWindows(settings.difficulty);

  const summary = useMemo(
    () => summarizeResults(judgedCategories, expectedHitsRef.current.length, capturedHits.length),
    [capturedHits.length, judgedCategories],
  );

  const activePreset = getPresetByMeter(selectedMeter);
  const currentLessonPreset = getPresetByMeter(currentLessonSelection.meter);
  const currentLessonLevel =
    currentLessonPreset.levels.find((level) => level.id === currentLessonSelection.levelId) ??
    currentLessonPreset.levels[0];
  const currentLessonPhrase =
    currentLessonLevel.phrases[currentLessonPhraseIndex] ?? currentLessonLevel.phrases[0];
  const copyPattern = useMemo(() => createCopyRhythmPattern(copyMeter, copyBarCount), [copyBarCount, copyMeter]);
  const currentPlayer = players.find((player) => player.id === currentPlayerId) ?? null;

  function cleanupSession() {
    if (sessionTimerRef.current) {
      window.clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }
    if (playStartTimeoutRef.current) {
      window.clearTimeout(playStartTimeoutRef.current);
      playStartTimeoutRef.current = null;
    }
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }

  function cleanupCopyRhythm() {
    if (copyIntervalRef.current) {
      window.clearInterval(copyIntervalRef.current);
      copyIntervalRef.current = null;
    }
    if (copyCountdownIntervalRef.current) {
      window.clearInterval(copyCountdownIntervalRef.current);
      copyCountdownIntervalRef.current = null;
    }
    if (copyCountdownTimeoutRef.current) {
      window.clearTimeout(copyCountdownTimeoutRef.current);
      copyCountdownTimeoutRef.current = null;
    }
    copyTimeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    copyTimeoutRefs.current = [];
    copyPerformanceBeatRef.current.active = false;
  }

  function handleAddPlayer() {
    const name = newPlayerName.trim();
    if (!name) {
      return;
    }

    const player = createPlayer(name);
    setPlayers((current) => [...current, player]);
    setCurrentPlayerId(player.id);
    setNewPlayerName("");
  }

  function saveAttempt(attempt: RhythmAttempt) {
    if (!currentPlayerId) {
      return;
    }

    setPlayers((current) =>
      current.map((player) =>
        player.id === currentPlayerId
          ? {
              ...player,
              updatedAt: attempt.playedAt,
              attempts: [attempt, ...player.attempts].slice(0, 200),
            }
          : player,
      ),
    );
  }

  function saveBasicAttempt() {
    if (selectedMode.id !== "basic-rhythm") {
      return;
    }

    saveAttempt({
      id: createAttemptId(),
      mode: "basic-rhythm",
      playedAt: new Date().toISOString(),
      meter: currentLessonSelection.meter,
      levelId: currentLessonSelection.levelId,
      levelTitle: currentLessonLevel.title,
      phraseIndex: currentLessonPhraseIndex,
      onTime: summary.onTime,
      early: summary.early,
      late: summary.late,
      misses: missCount,
      totalExpected: summary.totalExpected,
      cleared: isBasicCleared(summary, missCount),
    });
  }

  function saveCopyAttempt(results: CopyResult[]) {
    const correct = results.filter((result) => result.judgement === "correct").length;
    saveAttempt({
      id: createAttemptId(),
      mode: "copy-rhythm",
      playedAt: new Date().toISOString(),
      meter: copyMeter,
      barCount: copyBarCount,
      onTime: correct,
      misses: results.length - correct,
      totalExpected: copyPattern.length,
      cleared: results.length === copyPattern.length && correct === copyPattern.length,
    });
  }

  function queueCopyPoseFrame(frame: CopyPoseFrame, delayMs: number) {
    const timeoutId = window.setTimeout(() => {
      setCopyPoseFrame(frame);
    }, delayMs);
    copyTimeoutRefs.current.push(timeoutId);
  }

  function playCopyPose(pose: CopyPoseAction) {
    copyTimeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    copyTimeoutRefs.current = [];

    if (pose === "rest") {
      playCue(520, 70);
      setCopyPoseFrame("idle");
      return;
    }

    if (pose === "clap") {
      playTambourineCue(false);
      setCopyPoseFrame("clap_ready");
      queueCopyPoseFrame("clap_hit", 180);
      queueCopyPoseFrame("idle", 460);
      return;
    }

    if (pose === "step") {
      playStepCue(false);
      const frame = copyStepSideRef.current === "left" ? "step_left" : "step_right";
      copyStepSideRef.current = copyStepSideRef.current === "left" ? "right" : "left";
      setCopyPoseFrame(frame);
      queueCopyPoseFrame("idle", 360);
      return;
    }

    if (pose === "wave") {
      playCue(660, 90);
      const frame = copyWaveSideRef.current === "left" ? "wave_left" : "wave_right";
      copyWaveSideRef.current = copyWaveSideRef.current === "left" ? "right" : "left";
      setCopyPoseFrame(frame);
      queueCopyPoseFrame("idle", 360);
      return;
    }

    playCue(pose === "stop" ? 320 : 760, pose === "stop" ? 180 : 110);
    setCopyPoseFrame(pose);
    queueCopyPoseFrame("idle", pose === "stop" ? 520 : 380);
  }

  function startCopyRhythm() {
    cleanupSession();
    cleanupCopyRhythm();
    setCopyIsPlaying(true);
    setCopyMode("practice");
    setCopyPlayPhase("playing");
    setCopyCountdown(null);
    setCopyBeatIndex(0);
    copyResultsRef.current = [];
    setCopyResults([]);
    setFeedback({ text: "見本のポーズを見て、同じタイミングでまねします。", tone: "gentle" });

    const beatDurationMs = (60 / settings.bpm) * 1000;
    playCopyPose(copyPattern[0].pose);

    copyIntervalRef.current = window.setInterval(() => {
      setCopyBeatIndex((current) => {
        const nextIndex = (current + 1) % copyPattern.length;
        playCopyPose(copyPattern[nextIndex].pose);
        return nextIndex;
      });
    }, beatDurationMs);
  }

  function stopCopyRhythm() {
    cleanupCopyRhythm();
    setCopyIsPlaying(false);
    setCopyPlayPhase("idle");
    setCopyCountdown(null);
    setCopyBeatIndex(0);
    setCopyPoseFrame("idle");
    setFeedback({ text: "まねっこリズムを止めました。", tone: "gentle" });
  }

  function addCopyResult(index: number, judgement: CopyJudgement) {
    const step = copyPattern[index] ?? copyPattern[0];
    const result: CopyResult = {
      ...step,
      expectedInput: getCopyExpectedInput(step.pose),
      judgement,
    };
    copyResultsRef.current = [...copyResultsRef.current, result];
    setCopyResults((current) => [
      ...current,
      result,
    ]);
    return result;
  }

  function finishCopyPerformanceBeat() {
    const current = copyPerformanceBeatRef.current;
    if (!current.active) {
      return null;
    }

    const judgement =
      current.expectedInput === "none" ? (current.wrongInput ? "miss" : "correct") : current.matched ? "correct" : "miss";
    return addCopyResult(current.index, judgement);
  }

  function startCopyPerformanceBeat(index: number) {
    const step = copyPattern[index] ?? copyPattern[0];
    setCopyBeatIndex(index);
    playCopyPose(step.pose);
    copyPerformanceBeatRef.current = {
      active: true,
      index,
      startTime: performance.now(),
      expectedInput: getCopyExpectedInput(step.pose),
      matched: false,
      wrongInput: false,
    };
  }

  async function startCopyPerformance() {
    cleanupSession();
    cleanupCopyRhythm();
    setCopyMode("performance");
    setCopyIsPlaying(true);
    setCopyPlayPhase("countdown");
    setCopyCountdown(3);
    setCopyBeatIndex(0);
    copyResultsRef.current = [];
    setCopyResults([]);
    setCopyPoseFrame("idle");
    setFeedback({ text: "本番の準備をします。3つ数えたら始まります。", tone: "gentle" });

    await handlePrepareInputs();

    const beatDurationMs = (60 / settings.bpm) * 1000;
    const leadInMs = 2400;
    const startTime = performance.now() + leadInMs;
    let announcedCount = 3;
    playCountdownCue(announcedCount);

    copyCountdownIntervalRef.current = window.setInterval(() => {
      const remaining = Math.ceil((startTime - performance.now()) / 800);
      const nextCount = remaining > 0 ? remaining : 0;
      setCopyCountdown(nextCount);

      if (nextCount > 0 && nextCount !== announcedCount) {
        announcedCount = nextCount;
        playCountdownCue(nextCount);
      }
    }, 150);

    copyCountdownTimeoutRef.current = window.setTimeout(() => {
      if (copyCountdownIntervalRef.current) {
        window.clearInterval(copyCountdownIntervalRef.current);
        copyCountdownIntervalRef.current = null;
      }
      setCopyCountdown(null);
      setCopyPlayPhase("playing");
      setFeedback({ text: "本番です。見本と同じタイミングで動きましょう。", tone: "gentle" });
      startCopyPerformanceBeat(0);

      copyIntervalRef.current = window.setInterval(() => {
        finishCopyPerformanceBeat();
        const nextIndex = copyPerformanceBeatRef.current.index + 1;

        if (nextIndex >= copyPattern.length) {
          const finalResults = copyResultsRef.current;
          cleanupCopyRhythm();
          setCopyIsPlaying(false);
          setCopyPlayPhase("idle");
          setCopyCountdown(null);
          setCopyPoseFrame("idle");
          saveCopyAttempt(finalResults);
          setFeedback({ text: "本番が終わりました。結果を見てみましょう。", tone: "success" });
          return;
        }

        startCopyPerformanceBeat(nextIndex);
      }, beatDurationMs);
    }, leadInMs);
  }

  function handleCopyInput(event: HitEvent) {
    const current = copyPerformanceBeatRef.current;
    if (!current.active || copyMode !== "performance") {
      return;
    }

    const elapsed = event.time - current.startTime;
    if (elapsed < -judgeWindows.accept || elapsed > judgeWindows.accept) {
      return;
    }

    if (current.expectedInput === "none") {
      current.wrongInput = true;
      setFeedback({ text: "ここは止まる拍です。次はじっと待ちましょう。", tone: "retry" });
      return;
    }

    if (event.source === current.expectedInput) {
      current.matched = true;
      setFeedback({ text: "いいタイミングです。", tone: "success" });
      return;
    }

    current.wrongInput = true;
    setFeedback({ text: `${getCopyExpectedLabel(current.expectedInput)}の動きに合わせましょう。`, tone: "retry" });
  }

  function ensureAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }

  function getNoiseBuffer(context: AudioContext) {
    if (noiseBufferRef.current) {
      return noiseBufferRef.current;
    }

    const buffer = context.createBuffer(1, context.sampleRate * 0.25, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    noiseBufferRef.current = buffer;
    return buffer;
  }

  function playCue(frequency: number, durationMs: number) {
    const context = ensureAudioContext();
    const volume = getAudioVolumeGain(settings.soundVolume);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(context.destination);

    const now = context.currentTime;
    gain.gain.exponentialRampToValueAtTime(Math.min(0.95, 0.2 * volume), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000 + 0.02);
  }

  function playCountdownCue(count: number) {
    const frequency = count > 1 ? 740 : 880;
    playCue(frequency, 120);
  }

  function playTambourineCue(accented: boolean) {
    const context = ensureAudioContext();
    const volume = getAudioVolumeGain(settings.soundVolume);
    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer(context);

    const bandpass = context.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = accented ? 4200 : 3600;
    bandpass.Q.value = 0.9;

    const highpass = context.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 1800;

    const gain = context.createGain();
    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.95, (accented ? 0.42 : 0.28) * volume), now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    source.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(context.destination);

    source.start(now);
    source.stop(now + 0.14);
  }

  function playStepCue(accented: boolean) {
    const context = ensureAudioContext();
    const volume = getAudioVolumeGain(settings.soundVolume);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(accented ? 110 : 90, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(accented ? 58 : 48, context.currentTime + 0.16);

    filter.type = "lowpass";
    filter.frequency.value = 320;

    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.95, (accented ? 0.34 : 0.24) * volume), context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.2);
  }

  function playRhythmCue(step: PatternStep, accented: boolean) {
    if (step.note === "rest") {
      return;
    }

    if (step.action === "step") {
      playStepCue(accented);
      return;
    }

    playTambourineCue(accented);
  }

  function buildExpectedHits(pattern: PatternStep[], startTime: number, sessionSettings: TeacherSettings): ExpectedHit[] {
    const hits: ExpectedHit[] = [];
    const localBeatDurationMs = (60 / sessionSettings.bpm) * 1000;
    const patternLength = pattern.length;
    for (let loop = 0; loop < sessionSettings.loops; loop += 1) {
      pattern.forEach((step, index) => {
        if (step.note !== "rest" && step.action !== "rest") {
          hits.push({
            index: loop * patternLength + index,
            action: step.action,
            time: startTime + (loop * patternLength + index) * localBeatDurationMs,
            matched: false,
          });
        }
      });
    }
    return hits;
  }

  function judgeMisses(now: number) {
    let changed = false;
    expectedHitsRef.current = expectedHitsRef.current.map((expected) => {
      if (!expected.matched && now > expected.time + judgeWindows.accept) {
        changed = true;
        setMissCount((current) => current + 1);
        setFeedback(feedbackForTiming("miss"));
        return { ...expected, matched: true };
      }
      return expected;
    });

    const allResolved = expectedHitsRef.current.every((expected) => expected.matched);
    if (changed && allResolved && playState === "playing") {
      finishSession();
    }
  }

  function handleInput(event: HitEvent) {
    if (playState !== "playing") {
      return;
    }

    setCapturedHits((current) => [...current, event]);

    const inputAction = inputSourceToAction(event.source);
    const unresolved = expectedHitsRef.current.find(
      (expected) =>
        !expected.matched &&
        expected.action === inputAction &&
        Math.abs(event.time - expected.time) <= judgeWindows.accept,
    );

    if (!unresolved) {
      const wrongActionHit = expectedHitsRef.current.find(
        (expected) =>
          !expected.matched &&
          expected.action !== inputAction &&
          Math.abs(event.time - expected.time) <= judgeWindows.accept,
      );
      if (wrongActionHit) {
        setFeedback({
          text: `${getPatternActionLabel(wrongActionHit.action)}の拍です。動きを合わせましょう。`,
          tone: "retry",
        });
      }
      return;
    }

    const delta = event.time - unresolved.time;
    let category: TimingCategory = "onTime";
    if (Math.abs(delta) > judgeWindows.onTime) {
      category = delta < 0 ? "early" : "late";
    }

    unresolved.matched = true;
    setJudgedCategories((current) => [...current, category]);
    setFeedback(feedbackForTiming(category));
  }

  function finishSession() {
    cleanupSession();
    setPlayState("finished");
    setCountdown(null);
    setCurrentBeat(0);
    saveBasicAttempt();
    setFeedback({ text: "レッスンが終わりました。", tone: "success" });
    setScreen("result");
  }

  function openLesson(sessionSettings: TeacherSettings, message: string) {
    cleanupSession();
    setCapturedHits([]);
    setJudgedCategories([]);
    setMissCount(0);
    setCurrentBeat(0);
    setCountdown(null);
    setPlayState("idle");
    setSettings(sessionSettings);
    setScreen("lesson");
    setTeacherScreen(null);
    setFeedback({ text: message, tone: "gentle" });
  }

  function startSession(sessionSettings: TeacherSettings = settings) {
    cleanupSession();
    setCapturedHits([]);
    setJudgedCategories([]);
    setMissCount(0);
    setCurrentBeat(0);
    setSettings(sessionSettings);
    setScreen("lesson");
    setTeacherScreen(null);

    const leadInMs = 2400;
    const countdownStart = 3;
    const localBeatDurationMs = (60 / sessionSettings.bpm) * 1000;
    const patternLength = sessionSettings.pattern.length;
    const sessionStart = performance.now() + leadInMs;
    sessionStartRef.current = sessionStart;
    expectedHitsRef.current = buildExpectedHits(sessionSettings.pattern, sessionStart, sessionSettings);
    setPlayState("countdown");
    setFeedback({ text: "3拍前から数えます。譜面を見て準備しましょう。", tone: "gentle" });
    setCountdown(countdownStart);
    playCountdownCue(countdownStart);

    let announcedCount = countdownStart;
    countdownTimerRef.current = window.setInterval(() => {
      const remaining = Math.ceil((sessionStart - performance.now()) / 800);
      const nextCount = remaining > 0 ? remaining : 0;
      setCountdown(nextCount);

      if (nextCount > 0 && nextCount !== announcedCount) {
        announcedCount = nextCount;
        playCountdownCue(nextCount);
      }
    }, 150);

    playStartTimeoutRef.current = window.setTimeout(() => {
      setPlayState("playing");
      setCountdown(null);
      setCurrentBeat(0);
      if (sessionSettings.pattern[0]) {
        playRhythmCue(sessionSettings.pattern[0], true);
      }
      sessionTimerRef.current = window.setInterval(() => {
        const now = performance.now();
        const elapsed = now - sessionStartRef.current;
        const stepIndex = Math.floor(elapsed / localBeatDurationMs);
        const totalSteps = patternLength * sessionSettings.loops;

        if (stepIndex >= 1 && stepIndex < totalSteps) {
          const stepInPhrase = stepIndex % patternLength;
          setCurrentBeat(stepInPhrase);
          const isBarStart = stepInPhrase % sessionSettings.beatsPerBar === 0;
          const currentStep = sessionSettings.pattern[stepInPhrase];
          if (currentStep) {
            playRhythmCue(currentStep, isBarStart);
          } else {
            playCue(isBarStart ? 700 : 520, 80);
          }
        }

        judgeMisses(now);

        if (elapsed >= totalSteps * localBeatDurationMs + judgeWindows.accept) {
          finishSession();
        }
      }, localBeatDurationMs);
    }, leadInMs);
  }

  async function handlePrepareInputs() {
    const inputRequests: Promise<void>[] = [];
    if (useMicrophone) {
      inputRequests.push(microphone.requestStart());
    }
    if (useCamera) {
      inputRequests.push(camera.requestStart());
    }
    await Promise.all(inputRequests);
  }

  async function handleStartLesson() {
    await handlePrepareInputs();
    startSession();
  }

  function handleResetSettings() {
    setSettings(defaultSettings);
    setFeedback({ text: "設定を初期状態に戻しました。", tone: "gentle" });
  }

  function applyMode(modeId: string) {
    const mode = MODE_CARDS.find((item) => item.id === modeId) ?? MODE_CARDS[0];
    setSelectedMode(mode);

    if (modeId === "basic-rhythm") {
      setSelectedMeter(2);
      setSelectedLevelId("2-1");
      setCurrentLessonSelection({ meter: 2, levelId: "2-1" });
      setCurrentLessonPhraseIndex(0);
      setScreen("basicPresetSelect");
      setFeedback({ text: "基礎リズムモードの拍子とレベルを選びます。", tone: "gentle" });
      return;
    }

    if (modeId === "copy-rhythm") {
      cleanupSession();
      cleanupCopyRhythm();
      setCopyIsPlaying(false);
      setCopyMode("practice");
      setCopyPlayPhase("idle");
      setCopyCountdown(null);
      setCopyBeatIndex(0);
      setCopyPoseFrame("idle");
      setCopyResults([]);
      setSettings((current) => ({ ...current, inputMode: "both" }));
      setScreen("copyRhythm");
      setTeacherScreen(null);
      setFeedback({ text: "見本のポーズを見て、リズムに合わせてまねします。", tone: "gentle" });
      return;
    }

    let nextSettings: TeacherSettings;
    if (modeId === "instrument") {
      nextSettings = { ...settings, inputMode: "microphone" };
    } else if (modeId === "conductor") {
      nextSettings = { ...settings, inputMode: "camera" };
    } else {
      nextSettings = { ...settings, inputMode: "both" };
    }

    openLesson(nextSettings, `${mode.title} の準備ができました。スタートを押してください。`);
  }

  function renderModeSelect() {
    return (
      <main className="screen screen-select dojo-top-screen">
        <section className="wire-box wire-hero dojo-hero">
          <p className="wire-label">BOX 1</p>
          <p className="eyebrow">Start</p>
          <h1>トップ / モード選択</h1>
          <p className="subtitle">
            ここが最初の画面です。生徒向けのモードをここで選びます。教師向けの設定と譜面作成は別画面に分けています。
          </p>
        </section>

        <section className="wire-grid dojo-top-grid">
          <section className="wire-box wire-mode-list dojo-mode-board">
            <div className="wire-box-header">
              <div>
                <p className="wire-label">BOX 2</p>
                <h2>モード選択</h2>
              </div>
            </div>

            <div className="mode-select-grid">
              {MODE_CARDS.map((mode) => {
                const isAvailable = AVAILABLE_MODE_IDS.has(mode.id);

                return (
                <button
                  className={`${selectedMode.id === mode.id ? "mode-select-card selected" : "mode-select-card"}${
                    isAvailable ? "" : " is-under-construction"
                  }`}
                  disabled={!isAvailable}
                  key={mode.id}
                  onClick={() => applyMode(mode.id)}
                  type="button"
                >
                  {!isAvailable ? <span className="construction-badge">工事中</span> : null}
                  <div className="mode-entry">
                    <div className="mode-icon" aria-hidden="true">
                      {mode.icon}
                    </div>
                    <div className="mode-entry-copy">
                      <span className="mode-number">モード {mode.tag}</span>
                      <h3>{mode.title}</h3>
                    </div>
                  </div>
                  <p className="mode-learn">学習: {mode.learn}</p>
                  <p>{mode.description}</p>
                </button>
                );
              })}
            </div>
          </section>

          <section className="wire-box wire-teacher-tools wire-teacher-tools-full dojo-player-panel">
            <div className="player-panel-grid">
              <div>
                <p className="wire-label">PLAYER</p>
                <h2>プレイヤー</h2>
              </div>
              <div className="player-controls">
                <select
                  aria-label="プレイヤー選択"
                  onChange={(event) => setCurrentPlayerId(event.target.value)}
                  value={currentPlayerId}
                >
                  <option value="">未選択</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="新しいプレイヤー名"
                  onChange={(event) => setNewPlayerName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleAddPlayer();
                    }
                  }}
                  placeholder="名前を入力"
                  value={newPlayerName}
                />
                <button className="ghost-button" onClick={handleAddPlayer} type="button">
                  登録
                </button>
                <button className="primary-button" disabled={!currentPlayer} onClick={() => setScreen("records")} type="button">
                  記録を見る
                </button>
              </div>
              <p className="result-note">
                {currentPlayer ? `${currentPlayer.name} の記録に保存します。` : "プレイヤーを選ぶと、結果が記録に保存されます。"}
              </p>
            </div>
          </section>

          <section className="wire-box wire-teacher-tools wire-teacher-tools-full dojo-teacher-tools">
            <div className="wire-box-header">
              <div>
                <p className="wire-label">BOX 3</p>
                <h2>教師向けツール</h2>
              </div>
            </div>

            <div className="teacher-tool-grid">
              <div className="teacher-tool-card">
                <div className="mode-icon" aria-hidden="true">
                  ⚙️
                </div>
                <div>
                  <h3>設定</h3>
                  <p className="result-note">BPM、拍数、判定、入力方法を調整します。</p>
                </div>
                <button className="ghost-button" onClick={() => setTeacherScreen("settings")} type="button">
                  開く
                </button>
              </div>

              <div className="teacher-tool-card">
                <div className="mode-icon" aria-hidden="true">
                  📝
                </div>
                <div>
                  <h3>譜面作成</h3>
                  <p className="result-note">教師用のフリー作成モードとして、譜面や課題を作る箱です。</p>
                </div>
                <button
                  className="ghost-button"
                  onClick={() => {
                    setBuilderSettings(settings);
                    setTeacherScreen("scoreBuilder");
                  }}
                  type="button"
                >
                  開く
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>
    );
  }

  function renderBasicPresetSelect() {
    return (
      <main className="screen screen-select basic-select-screen">
        <section className="wire-box wire-hero basic-select-hero">
          <p className="wire-label">BASIC RHYTHM</p>
          <p className="eyebrow">Preset</p>
          <h1>基礎リズムモード</h1>
          <p className="subtitle">
            2拍子、3拍子、4拍子、8拍子のプリセットから選びます。まずは 2拍子の「交互」「進む」「一定で続ける」感覚から始められます。
          </p>
        </section>

        <section className="wire-box preset-box basic-preset-board">
          <div className="wire-box-header">
            <div>
              <p className="wire-label">PRESET BOX</p>
              <h2>拍子を選ぶ</h2>
            </div>
            <button className="ghost-button" onClick={() => setScreen("modeSelect")} type="button">
              モード選択へ戻る
            </button>
          </div>

          <div className="meter-tabs basic-meter-tabs">
            {BASIC_RHYTHM_PRESETS.map((preset) => (
              <button
                className={selectedMeter === preset.meter ? "meter-tab active" : "meter-tab"}
                key={preset.meter}
                onClick={() => {
                  setSelectedMeter(preset.meter);
                  setSelectedLevelId(preset.levels[0].id);
                }}
                type="button"
              >
                {preset.meter}拍子
              </button>
            ))}
          </div>

          <div className="preset-overview basic-preset-overview">
            <img className="basic-guide-character" src="/poses/idle.png" alt="" aria-hidden="true" />
            <div className="preset-summary">
              <h3>{activePreset.title}</h3>
              <p className="result-note">{activePreset.tagline}</p>
              <p className="preset-accent">流れ: {activePreset.accent}</p>
            </div>
            <div className="preset-goals">
              {activePreset.goals.map((goal) => (
                <span className="goal-chip" key={goal}>
                  {goal}
                </span>
              ))}
            </div>
          </div>

          <div className="preset-level-grid basic-level-grid">
            {activePreset.levels.map((level, index) => (
              <article className={selectedLevelId === level.id ? "preset-level-card active" : "preset-level-card"} key={level.id}>
                <img className="basic-level-character" src={index % 2 === 0 ? "/poses/clap_ready.png" : "/poses/step_left.png"} alt="" aria-hidden="true" />
                <h3>{level.title}</h3>
                <p className="mode-learn">目的: {level.goals.join(" / ")}</p>
                <div className="preset-example-list">
                  {level.phrases.map((phrase, phraseIdx) => (
                    <div className="preset-example" key={`${level.id}-${phraseIdx}`}>
                      {formatPhrase(phrase, activePreset.meter)}
                    </div>
                  ))}
                </div>
                <button
                  className="primary-button basic-level-start-btn"
                  onClick={() => {
                    setSelectedLevelId(level.id);
                    setCurrentLessonSelection({ meter: activePreset.meter, levelId: level.id });
                    setCurrentLessonPhraseIndex(0);
                    openLesson(
                      createSettingsFromBasicLevel(activePreset.meter, level.id, settings, 0),
                      `${activePreset.title} の ${level.title} を始める準備ができました。`,
                    );
                  }}
                  type="button"
                >
                  このレベルを選ぶ
                </button>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  }

  function renderCopyRhythm() {
    const activeStep = copyPattern[copyBeatIndex] ?? copyPattern[0];
    const copyCorrectCount = copyResults.filter((result) => result.judgement === "correct").length;

    return (
      <main className="screen screen-lesson copy-rhythm-screen">
        {useCamera ? (
          <video aria-hidden="true" className="motion-video-hidden" muted playsInline ref={camera.videoRef} />
        ) : null}
        <section className="wire-box lesson-shell copy-rhythm-shell">
          <div className="wire-box-header">
            <div>
              <p className="wire-label">COPY RHYTHM</p>
              <p className="eyebrow">Pose Pattern</p>
              <h1>まねっこリズムモード</h1>
              <p className="subtitle">キャラクターのポーズが拍ごとに切り替わります。同じタイミングでまねします。</p>
            </div>
            <button
              className="ghost-button"
              onClick={() => {
                stopCopyRhythm();
                setScreen("modeSelect");
              }}
              type="button"
            >
              トップへ戻る
            </button>
          </div>

          <div className="copy-rhythm-layout">
            <section className="copy-character-stage" aria-label="見本キャラクター">
              <div className="copy-beat-display">
                <span>拍 {activeStep.beat}</span>
                <em>{copyMode === "performance" ? "本番" : "練習"}</em>
              </div>
              <div className="copy-adjust-panel copy-stage-settings">
                <div className="copy-stage-tempo">
                  <span>テンポ</span>
                  <strong>{settings.bpm} BPM</strong>
                  {!copyIsPlaying ? (
                    <div className="inline-control-row">
                      <button
                        className="ghost-button small"
                        onClick={() => setSettings((current) => ({ ...current, bpm: Math.max(50, current.bpm - 2) }))}
                        type="button"
                      >
                        -2
                      </button>
                      <button
                        className="ghost-button small"
                        onClick={() => setSettings((current) => ({ ...current, bpm: Math.min(160, current.bpm + 2) }))}
                        type="button"
                      >
                        +2
                      </button>
                    </div>
                  ) : null}
                </div>

                <label className="field">
                  <span>拍子</span>
                  <select
                    disabled={copyIsPlaying}
                    onChange={(event) => {
                      const nextMeter = Number(event.target.value);
                      setCopyMeter(nextMeter === 2 || nextMeter === 3 || nextMeter === 8 ? nextMeter : 4);
                      setCopyBeatIndex(0);
                      setCopyResults([]);
                    }}
                    value={copyMeter}
                  >
                    <option value={2}>2拍子</option>
                    <option value={3}>3拍子</option>
                    <option value={4}>4拍子</option>
                    <option value={8}>8拍子</option>
                  </select>
                </label>

                <label className="field">
                  <span>小節数</span>
                  <select
                    disabled={copyIsPlaying}
                    onChange={(event) => {
                      setCopyBarCount(Number(event.target.value));
                      setCopyBeatIndex(0);
                      setCopyResults([]);
                    }}
                    value={copyBarCount}
                  >
                    <option value={1}>1小節</option>
                    <option value={2}>2小節</option>
                    <option value={3}>3小節</option>
                    <option value={4}>4小節</option>
                  </select>
                </label>

                <label className="field">
                  <span>再生音量</span>
                  <input
                    max={3}
                    min={0}
                    onChange={(event) => setSettings((current) => ({ ...current, soundVolume: Number(event.target.value) }))}
                    step={0.1}
                    type="range"
                    value={settings.soundVolume}
                  />
                  <strong>{Math.round(settings.soundVolume * 100)}%</strong>
                </label>

                <label className="field">
                  <span>手拍子感度</span>
                  <input
                    max={0.45}
                    min={0.06}
                    onChange={(event) => setSettings((current) => ({ ...current, clapThreshold: Number(event.target.value) }))}
                    step={0.01}
                    type="range"
                    value={settings.clapThreshold}
                  />
                  <strong>{settings.clapThreshold.toFixed(2)}</strong>
                </label>

                <label className="field">
                  <span>動き感度</span>
                  <input
                    max={0.3}
                    min={0.04}
                    onChange={(event) => setSettings((current) => ({ ...current, motionThreshold: Number(event.target.value) }))}
                    step={0.01}
                    type="range"
                    value={settings.motionThreshold}
                  />
                  <strong>{settings.motionThreshold.toFixed(2)}</strong>
                </label>
              </div>
              <div className="copy-character-main">
              <div className="copy-character-frame">
                {copyPlayPhase === "countdown" ? (
                  <div className="copy-countdown-focus" aria-live="polite">
                    <span>{copyCountdown ?? 0}</span>
                  </div>
                ) : missingPoseFrames[copyPoseFrame] ? (
                  <div className={`copy-pose-fallback ${copyPoseFrame}`}>
                    <span>{copyPoseFrame === "clap_ready" || copyPoseFrame === "clap_hit" ? "👏" : "♪"}</span>
                    <strong>{getCopyPoseLabel(activeStep.pose)}</strong>
                    <small>{COPY_POSE_SRC[copyPoseFrame]} を配置すると画像に切り替わります</small>
                  </div>
                ) : (
                  <img
                    alt={`${getCopyPoseLabel(activeStep.pose)}の見本ポーズ`}
                    className="copy-pose-image"
                    onError={() => setMissingPoseFrames((current) => ({ ...current, [copyPoseFrame]: true }))}
                    src={COPY_POSE_SRC[copyPoseFrame]}
                  />
                )}
              </div>
              </div>
              <span className={`feedback-badge ${feedback.tone}`}>{feedback.text}</span>
            </section>

            <aside className="copy-control-panel">
              <div className="copy-action-card">
                <span>今の動き</span>
                <strong>{getCopyPoseLabel(activeStep.pose)}</strong>
                <small>{getCopyExpectedLabel(getCopyExpectedInput(activeStep.pose))}</small>
              </div>

              <div className="status-card gold lesson-control-card copy-side-tempo">
                <span>テンポ</span>
                <strong>{settings.bpm} BPM</strong>
                {!copyIsPlaying ? (
                  <div className="inline-control-row">
                    <button
                      className="ghost-button small"
                      onClick={() => setSettings((current) => ({ ...current, bpm: Math.max(50, current.bpm - 2) }))}
                      type="button"
                    >
                      -2
                    </button>
                    <button
                      className="ghost-button small"
                      onClick={() => setSettings((current) => ({ ...current, bpm: Math.min(160, current.bpm + 2) }))}
                      type="button"
                    >
                      +2
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="copy-adjust-panel copy-side-settings">
                <label className="field">
                  <span>拍子</span>
                  <select
                    disabled={copyIsPlaying}
                    onChange={(event) => {
                      const nextMeter = Number(event.target.value);
                      setCopyMeter(nextMeter === 2 || nextMeter === 3 || nextMeter === 8 ? nextMeter : 4);
                      setCopyBeatIndex(0);
                      setCopyResults([]);
                    }}
                    value={copyMeter}
                  >
                    <option value={2}>2拍子</option>
                    <option value={3}>3拍子</option>
                    <option value={4}>4拍子</option>
                    <option value={8}>8拍子</option>
                  </select>
                </label>

                <label className="field">
                  <span>小節数</span>
                  <select
                    disabled={copyIsPlaying}
                    onChange={(event) => {
                      setCopyBarCount(Number(event.target.value));
                      setCopyBeatIndex(0);
                      setCopyResults([]);
                    }}
                    value={copyBarCount}
                  >
                    <option value={1}>1小節</option>
                    <option value={2}>2小節</option>
                    <option value={3}>3小節</option>
                    <option value={4}>4小節</option>
                  </select>
                </label>

                <label className="field">
                  <span>再生音量</span>
                  <input
                    max={3}
                    min={0}
                    onChange={(event) => setSettings((current) => ({ ...current, soundVolume: Number(event.target.value) }))}
                    step={0.1}
                    type="range"
                    value={settings.soundVolume}
                  />
                  <strong>{Math.round(settings.soundVolume * 100)}%</strong>
                </label>

                <label className="field">
                  <span>手拍子感度</span>
                  <input
                    max={0.45}
                    min={0.06}
                    onChange={(event) => setSettings((current) => ({ ...current, clapThreshold: Number(event.target.value) }))}
                    step={0.01}
                    type="range"
                    value={settings.clapThreshold}
                  />
                  <strong>{settings.clapThreshold.toFixed(2)}</strong>
                </label>

                <label className="field">
                  <span>動き感度</span>
                  <input
                    max={0.3}
                    min={0.04}
                    onChange={(event) => setSettings((current) => ({ ...current, motionThreshold: Number(event.target.value) }))}
                    step={0.01}
                    type="range"
                    value={settings.motionThreshold}
                  />
                  <strong>{settings.motionThreshold.toFixed(2)}</strong>
                </label>
              </div>

              <div className="copy-pattern-list">
                {copyPattern.map((step, index) => (
                  <div className={index === copyBeatIndex ? "copy-pattern-step active" : "copy-pattern-step"} key={`${index}-${step.beat}`}>
                    <span>{step.beat}</span>
                    <strong>{getCopyPoseLabel(step.pose)}</strong>
                    <small>{getCopyExpectedLabel(getCopyExpectedInput(step.pose))}</small>
                  </div>
                ))}
              </div>

              {copyResults.length > 0 ? (
                <div className="copy-result-panel">
                  <h3>
                    結果 {copyCorrectCount} / {copyPattern.length}
                  </h3>
                  <div className="copy-result-list">
                    {copyResults.map((result, index) => (
                      <div className={`copy-result-item ${result.judgement}`} key={`${result.beat}-${index}`}>
                        <span>{result.beat}</span>
                        <strong>{result.judgement === "correct" ? "できた" : "もう一度"}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="start-bar copy-start-bar">
                {copyIsPlaying ? (
                  <button className="ghost-button" onClick={stopCopyRhythm} type="button">
                    停止
                  </button>
                ) : (
                  <>
                    <button className="ghost-button" onClick={startCopyRhythm} type="button">
                      練習スタート
                    </button>
                    <button className="primary-button" onClick={startCopyPerformance} type="button">
                      本番スタート
                    </button>
                  </>
                )}
              </div>
            </aside>
          </div>
        </section>
      </main>
    );
  }

  function renderLesson() {
    const lessonStatusText =
      playState === "countdown" ? `始まるまで ${countdown ?? 0}` : playState === "playing" ? "再生中" : "終了";

    if (playState !== "idle") {
      return (
        <main className="screen screen-lesson score-only-screen">
          {useCamera ? (
            <video
              aria-hidden="true"
              className="motion-video-hidden"
              muted
              playsInline
              ref={camera.videoRef}
            />
          ) : null}
          <section className="wire-box lesson-shell score-only-shell">
            <div className="score-only-status">
              <span className={`feedback-badge ${feedback.tone}`}>{feedback.text}</span>
              <strong>{lessonStatusText}</strong>
            </div>
            {playState === "countdown" ? (
              <div className="countdown-focus" aria-live="polite">
                <span>{countdown ?? 0}</span>
              </div>
            ) : null}
            <BeatGrid currentBeat={currentBeat} pattern={settings.pattern} />
          </section>
        </main>
      );
    }

    return (
      <main className={selectedMode.id === "basic-rhythm" ? "screen screen-lesson basic-lesson-screen" : "screen screen-lesson"}>
        <section className={selectedMode.id === "basic-rhythm" ? "wire-box lesson-shell basic-lesson-shell" : "wire-box lesson-shell"}>
          <div className="wire-box-header">
            <div>
              <p className="wire-label">LESSON BOX</p>
              <p className="eyebrow">LESSON</p>
              <h2>{selectedMode.title}</h2>
              {selectedMode.id === "basic-rhythm" ? (
                <p className="result-note">
                  {currentLessonPreset.title} / {currentLessonLevel.title}
                </p>
              ) : null}
            </div>
            <div className="lesson-header-actions">
              <button
                className="ghost-button"
                onClick={() => {
                  setPlayState("idle");
                  setScreen(selectedMode.id === "basic-rhythm" ? "basicPresetSelect" : "modeSelect");
                  setFeedback({ text: "練習する内容を選び直せます。", tone: "gentle" });
                }}
                type="button"
              >
                {selectedMode.id === "basic-rhythm" ? "レベル選択へ戻る" : "トップへ戻る"}
              </button>
              <span className={`feedback-badge ${feedback.tone}`}>{feedback.text}</span>
            </div>
          </div>

          {selectedMode.id === "basic-rhythm" ? (
            <div className="lesson-reference">
              <img className="basic-lesson-character" src="/poses/clap_hit.png" alt="" aria-hidden="true" />
              <div>
                <p className="wire-label">REFERENCE SCORE</p>
                <h3>{currentLessonLevel.title}</h3>
                <p className="result-note">
                  譜面 {currentLessonPhraseIndex + 1} / {currentLessonLevel.phrases.length}
                </p>
                <p className="mode-learn">目的 {currentLessonLevel.goals.join(" / ")}</p>
              </div>
              <div className="lesson-reference-examples">
                <div className="preset-example current-phrase">
                  {formatPhrase(currentLessonPhrase, currentLessonPreset.meter)}
                </div>
              </div>
            </div>
          ) : null}

          {useMicrophone || useCamera ? (
            <div className="input-monitor-grid">
              {useMicrophone ? (
                <div className="input-monitor-panel">
                  <div className="input-monitor-icon" aria-hidden="true">
                    👏
                  </div>
                  <div>
                    <p className="wire-label">MIC CLAP</p>
                    <p className="result-note">
                      手拍子判定:{" "}
                      {microphone.active ? "有効" : microphone.permission === "denied" ? "許可が必要" : "待機中"} / 音量{" "}
                      {microphone.level.toFixed(2)} / しきい値 {settings.clapThreshold.toFixed(2)}
                    </p>
                    {microphone.error ? <p className="error-text">{microphone.error}</p> : null}
                  </div>
                </div>
              ) : null}

              {useCamera ? (
                <div className="input-monitor-panel">
                  <video
                    aria-label="足ぶみ判定用カメラ映像"
                    className="motion-video"
                    muted
                    playsInline
                    ref={camera.videoRef}
                  />
                  <div>
                    <p className="wire-label">CAMERA MOTION</p>
                    <p className="result-note">
                      足ぶみ判定: {camera.active ? "有効" : camera.permission === "denied" ? "許可が必要" : "待機中"} / 反応{" "}
                      {camera.motionLevel.toFixed(2)} / しきい値 {settings.motionThreshold.toFixed(2)}
                    </p>
                    {camera.error ? <p className="error-text">{camera.error}</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="status-row lesson-status">
            <div className="status-card gold lesson-control-card">
              <span>テンポ</span>
              <strong>{settings.bpm} BPM</strong>
              {playState === "idle" ? (
                <div className="inline-control-row">
                  <button
                    className="ghost-button small"
                    onClick={() => setSettings((current) => ({ ...current, bpm: Math.max(50, current.bpm - 2) }))}
                    type="button"
                  >
                    -2
                  </button>
                  <button
                    className="ghost-button small"
                    onClick={() => setSettings((current) => ({ ...current, bpm: Math.min(160, current.bpm + 2) }))}
                    type="button"
                  >
                    +2
                  </button>
                </div>
              ) : null}
            </div>

            <div className="status-card gold lesson-control-card">
              <span>再生音量</span>
              <strong>{Math.round(settings.soundVolume * 100)}%</strong>
              <input
                aria-label="再生音量"
                className="compact-range"
                max={3}
                min={0}
                onChange={(event) => setSettings((current) => ({ ...current, soundVolume: Number(event.target.value) }))}
                step={0.1}
                type="range"
                value={settings.soundVolume}
              />
            </div>

            <div className="status-card green lesson-control-card">
              <span>入力</span>
              {playState === "idle" ? (
                <select
                  className="lesson-inline-select"
                  onChange={(event) =>
                    setSettings((current) => {
                      const nextInputMode = event.target.value as TeacherSettings["inputMode"];
                      const nextSettings = {
                        ...current,
                        inputMode: nextInputMode,
                      };

                      return {
                        ...nextSettings,
                        pattern:
                          selectedMode.id === "basic-rhythm"
                            ? createSettingsFromBasicLevel(
                                currentLessonSelection.meter,
                                currentLessonSelection.levelId,
                                nextSettings,
                                currentLessonPhraseIndex,
                              ).pattern
                            : current.pattern,
                      };
                    })
                  }
                  value={settings.inputMode}
                >
                  <option value="both">手拍子 + 足ぶみ</option>
                  <option value="microphone">手拍子のみ</option>
                  <option value="camera">足ぶみのみ</option>
                </select>
              ) : (
                <strong>{getInputModeLabel(settings.inputMode)}</strong>
              )}
            </div>

            <div className="status-card blue lesson-control-card lesson-start-card">
              <span>レッスン</span>
              {playState === "idle" ? (
                <button className="primary-button lesson-start-button" onClick={handleStartLesson} type="button">
                  スタート
                </button>
              ) : (
                <strong>{lessonStatusText}</strong>
              )}
            </div>
          </div>

          <BeatGrid currentBeat={currentBeat} pattern={settings.pattern} />
        </section>
      </main>
    );
  }

  function renderResult() {
    return (
      <main className="screen screen-result">
        <section className="wire-box result-screen-card lesson-result-card">
          <div className="wire-box-header">
            <div>
              <p className="wire-label">RESULT BOX</p>
              <p className="eyebrow">Result</p>
              <h1>レッスン結果</h1>
            </div>
            <span className={`feedback-badge ${feedback.tone}`}>{feedback.text}</span>
          </div>

          <div className="result-grid">
            <StatusCard accent="gold" label="ぴったり" value={`${summary.onTime}`} />
            <StatusCard accent="blue" label="はやい" value={`${summary.early}`} />
            <StatusCard accent="green" label="おそい" value={`${summary.late}`} />
            <StatusCard accent="blue" label="ミス" value={`${missCount}`} />
          </div>

          <p className="result-note">基礎リズムモードでは、拍子とレベルを変えながら繰り返し学習できます。</p>

          <div className="start-bar">
            <button
              className="ghost-button"
              onClick={() => {
                setPlayState("idle");
                setFeedback({ text: "モードを選んでレッスンを始めます。", tone: "gentle" });
                setScreen(selectedMode.id === "basic-rhythm" ? "basicPresetSelect" : "modeSelect");
              }}
              type="button"
            >
              戻る
            </button>
            {selectedMode.id === "basic-rhythm" && currentLessonPhraseIndex < currentLessonLevel.phrases.length - 1 ? (
              <button
                className="ghost-button"
                onClick={() => {
                  const nextPhraseIndex = currentLessonPhraseIndex + 1;
                  setCurrentLessonPhraseIndex(nextPhraseIndex);
                  openLesson(
                    createSettingsFromBasicLevel(
                      currentLessonSelection.meter,
                      currentLessonSelection.levelId,
                      settings,
                      nextPhraseIndex,
                    ),
                    `次の譜面 ${nextPhraseIndex + 1} / ${currentLessonLevel.phrases.length} の準備ができました。スタートを押してください。`,
                  );
                }}
                type="button"
              >
                次の譜面へ
              </button>
            ) : null}
            <button
              className="primary-button"
              onClick={() =>
                openLesson(
                  settings,
                  `${selectedMode.id === "basic-rhythm" ? "同じ譜面" : selectedMode.title} の準備ができました。スタートを押してください。`,
                )
              }
              type="button"
            >
              同じ譜面でもう一度
            </button>
          </div>
        </section>
      </main>
    );
  }

  function renderRecords() {
    const attempts = currentPlayer?.attempts ?? [];
    const clearedCount = attempts.filter((attempt) => attempt.cleared).length;
    const perfectCount = attempts.reduce((total, attempt) => total + attempt.onTime, 0);

    return (
      <main className="screen screen-result">
        <section className="wire-box result-screen-card records-screen-card">
          <div className="wire-box-header">
            <div>
              <p className="wire-label">PLAYER RECORDS</p>
              <p className="eyebrow">Records</p>
              <h1>記録</h1>
            </div>
            <button className="ghost-button" onClick={() => setScreen("modeSelect")} type="button">
              トップへ戻る
            </button>
          </div>

          <div className="result-grid compact">
            <StatusCard accent="gold" label="プレイヤー" value={currentPlayer?.name ?? "未選択"} />
            <StatusCard accent="green" label="クリア" value={`${clearedCount}`} />
            <StatusCard accent="blue" label="ぴったり累計" value={`${perfectCount}`} />
          </div>

          <div className="record-list">
            {attempts.length > 0 ? (
              attempts.map((attempt) => (
                <article className="record-item" key={attempt.id}>
                  <div>
                    <span className={attempt.cleared ? "record-badge cleared" : "record-badge"}>
                      {attempt.cleared ? "クリア" : "練習中"}
                    </span>
                    <h3>{attempt.mode === "basic-rhythm" ? "基礎リズム" : "まねっこリズム"}</h3>
                    <p className="result-note">
                      {attempt.mode === "basic-rhythm"
                        ? `${attempt.meter}拍子 / ${attempt.levelTitle} / 譜面${attempt.phraseIndex + 1}`
                        : `${attempt.meter}拍子 / ${attempt.barCount}小節`}
                    </p>
                  </div>
                  <strong>
                    ぴったり {attempt.onTime} / {attempt.totalExpected}
                  </strong>
                  <small>{new Date(attempt.playedAt).toLocaleString("ja-JP")}</small>
                </article>
              ))
            ) : (
              <p className="result-note">まだ記録がありません。</p>
            )}
          </div>
        </section>
      </main>
    );
  }

  function renderTeacherSettings() {
    return (
      <main className="screen screen-result">
        <section className="wire-box result-screen-card">
          <div className="wire-box-header">
            <div>
              <p className="wire-label">SETTINGS SCREEN</p>
              <p className="eyebrow">Settings</p>
              <h1>授業用の設定</h1>
            </div>
            <button className="ghost-button" onClick={() => setTeacherScreen(null)} type="button">
              トップへ戻る
            </button>
          </div>
          <SettingsPanel onChange={setSettings} onReset={handleResetSettings} settings={settings} />
        </section>
      </main>
    );
  }

  function updateBuilder<K extends keyof TeacherSettings>(key: K, value: TeacherSettings[K]) {
    setBuilderSettings((current) => ({ ...current, [key]: value }));
  }

  function updateBuilderBeats(beatsPerBar: BeatCount) {
    setBuilderSettings((current) => ({
      ...current,
      beatsPerBar,
      pattern: updatePatternLength(current.pattern, beatsPerBar),
    }));
  }

  function updateBuilderStep(index: number, updates: Partial<Pick<PatternStep, "action" | "note">>) {
    setBuilderSettings((current) => ({
      ...current,
      pattern: current.pattern.map((step, stepIndex) => {
        if (stepIndex !== index) {
          return step;
        }

        const action = updates.action ?? step.action;
        const requestedNote = updates.note ?? step.note;
        const note = action === "rest" ? "rest" : requestedNote === "rest" ? "quarter" : requestedNote;

        return {
          ...step,
          action,
          note,
        };
      }),
    }));
  }

  function normalizeBuilderSettings() {
    return {
      ...builderSettings,
      pattern: builderSettings.pattern.map((step, index) => ({
        ...step,
        id: index,
        action: step.note === "rest" ? "rest" : step.action,
      })),
    };
  }

  function saveBuilderAsSettings() {
    const nextSettings = normalizeBuilderSettings();
    setBuilderSettings(nextSettings);
    setSettings(nextSettings);
    setFeedback({ text: "作成した譜面を設定に保存しました。", tone: "success" });
  }

  function startBuilderLesson() {
    const nextSettings = normalizeBuilderSettings();
    setSelectedMode({
      id: "custom-score",
      title: "譜面作成",
      tag: "T",
      icon: "♪",
      learn: "教師用の自由課題",
      description: "作成した譜面で練習します。",
    });
    openLesson(nextSettings, "作成した譜面の準備ができました。スタートを押してください。");
  }

  function renderScoreBuilder() {
    return (
      <main className="screen screen-result">
        <section className="wire-box result-screen-card">
          <div className="wire-box-header">
            <div>
              <p className="wire-label">SCORE BUILDER</p>
              <p className="eyebrow">Teacher Tool</p>
              <h1>譜面作成</h1>
            </div>
            <button className="ghost-button" onClick={() => setTeacherScreen(null)} type="button">
              トップへ戻る
            </button>
          </div>
          <p className="result-note">
            拍子、テンポ、入力方法、各拍の動きを組み合わせて、そのままレッスンに使えます。
          </p>

          <div className="builder-layout">
            <section className="builder-controls" aria-label="譜面設定">
              <div className="settings-grid">
                <label className="field">
                  <span>BPM</span>
                  <input
                    max={160}
                    min={50}
                    onChange={(event) => updateBuilder("bpm", Number(event.target.value))}
                    type="range"
                    value={builderSettings.bpm}
                  />
                  <strong>{builderSettings.bpm}</strong>
                </label>

                <label className="field">
                  <span>拍子</span>
                  <select
                    onChange={(event) => {
                      const raw = Number(event.target.value);
                      updateBuilderBeats(raw === 2 || raw === 3 || raw === 8 ? raw : 4);
                    }}
                    value={builderSettings.beatsPerBar}
                  >
                    <option value={2}>2拍子</option>
                    <option value={3}>3拍子</option>
                    <option value={4}>4拍子</option>
                    <option value={8}>8拍子</option>
                  </select>
                </label>

                <label className="field">
                  <span>くり返し</span>
                  <select
                    onChange={(event) => updateBuilder("loops", Number(event.target.value))}
                    value={builderSettings.loops}
                  >
                    <option value={1}>1回</option>
                    <option value={2}>2回</option>
                    <option value={3}>3回</option>
                  </select>
                </label>

                <label className="field">
                  <span>入力</span>
                  <select
                    onChange={(event) => updateBuilder("inputMode", event.target.value as TeacherSettings["inputMode"])}
                    value={builderSettings.inputMode}
                  >
                    <option value="both">{getInputModeLabel("both")}</option>
                    <option value="microphone">{getInputModeLabel("microphone")}</option>
                    <option value="camera">{getInputModeLabel("camera")}</option>
                  </select>
                </label>

                <label className="field">
                  <span>判定</span>
                  <select
                    onChange={(event) => updateBuilder("difficulty", event.target.value as TeacherSettings["difficulty"])}
                    value={builderSettings.difficulty}
                  >
                    <option value="easy">{getDifficultyLabel("easy")}</option>
                    <option value="normal">{getDifficultyLabel("normal")}</option>
                    <option value="relaxed">{getDifficultyLabel("relaxed")}</option>
                  </select>
                </label>

                <label className="field">
                  <span>再生音量</span>
                  <input
                    max={3}
                    min={0}
                    onChange={(event) => updateBuilder("soundVolume", Number(event.target.value))}
                    step={0.1}
                    type="range"
                    value={builderSettings.soundVolume}
                  />
                  <strong>{Math.round(builderSettings.soundVolume * 100)}%</strong>
                </label>
              </div>
            </section>

            <section className="builder-score-editor" aria-label="拍ごとの編集">
              <div className="builder-step-grid">
                {builderSettings.pattern.map((step, index) => (
                  <article className={`builder-step-card ${step.action}`} key={step.id}>
                    <div className="builder-step-top">
                      <span className="beat-chip">{index + 1}</span>
                      <strong>{getNoteSymbol(step.note)}</strong>
                    </div>

                    <label className="field compact">
                      <span>音符</span>
                      <select
                        onChange={(event) => updateBuilderStep(index, { note: event.target.value as NoteValue })}
                        value={step.note}
                      >
                        {BUILDER_NOTE_OPTIONS.map((note) => (
                          <option key={note} value={note}>
                            {getNoteSymbol(note)} {getNoteLabel(note)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="builder-action-row" role="group" aria-label={`${index + 1}拍目の動き`}>
                      {BUILDER_ACTION_OPTIONS.map((action) => (
                        <button
                          className={step.action === action ? "builder-action-button active" : "builder-action-button"}
                          key={action}
                          onClick={() => updateBuilderStep(index, { action })}
                          type="button"
                        >
                          <span aria-hidden="true">{getPatternActionIcon(action)}</span>
                          {getPatternActionLabel(action)}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="builder-preview" aria-label="譜面プレビュー">
              <div className="result-grid compact">
                <StatusCard accent="gold" label="BPM" value={`${builderSettings.bpm}`} />
                <StatusCard accent="blue" label="拍子" value={`${builderSettings.beatsPerBar}拍子`} />
                <StatusCard accent="green" label="入力" value={getInputModeLabel(builderSettings.inputMode)} />
              </div>
              <BeatGrid currentBeat={0} pattern={builderSettings.pattern} />
            </section>

            <div className="start-bar">
              <button className="ghost-button" onClick={saveBuilderAsSettings} type="button">
                設定に保存
              </button>
              <button className="primary-button" onClick={startBuilderLesson} type="button">
                この譜面でレッスン
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      {teacherScreen === "settings"
        ? renderTeacherSettings()
        : teacherScreen === "scoreBuilder"
          ? renderScoreBuilder()
          : screen === "modeSelect"
            ? renderModeSelect()
            : screen === "basicPresetSelect"
              ? renderBasicPresetSelect()
              : screen === "copyRhythm"
                ? renderCopyRhythm()
                : screen === "lesson"
                  ? renderLesson()
                  : screen === "records"
                    ? renderRecords()
                    : renderResult()}
    </div>
  );
}

export default App;
