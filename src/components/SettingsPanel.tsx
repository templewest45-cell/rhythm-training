import type { ChangeEvent } from "react";
import type { PatternAction, PatternStep, TeacherSettings } from "../types";
import {
  getDifficultyLabel,
  getInputModeLabel,
  getPatternActionIcon,
  getPatternActionLabel,
  updatePatternLength,
} from "../utils/rhythm";

type SettingsPanelProps = {
  settings: TeacherSettings;
  onChange: (settings: TeacherSettings) => void;
  onReset: () => void;
};

const ACTION_ORDER: PatternAction[] = ["rest", "clap", "step"];

const getNextAction = (action: PatternAction): PatternAction => {
  const index = ACTION_ORDER.indexOf(action);
  return ACTION_ORDER[(index + 1) % ACTION_ORDER.length];
};

export function SettingsPanel({ settings, onChange, onReset }: SettingsPanelProps) {
  const update = <K extends keyof TeacherSettings>(key: K, value: TeacherSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleBeatsChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const raw = Number(event.target.value);
    const beatsPerBar = raw === 2 || raw === 3 || raw === 8 ? raw : 4;
    onChange({
      ...settings,
      beatsPerBar,
      pattern: updatePatternLength(settings.pattern, beatsPerBar),
    });
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Teacher Setup</p>
          <h2>授業用の設定</h2>
        </div>
        <button className="ghost-button" onClick={onReset} type="button">
          初期設定に戻す
        </button>
      </div>

      <div className="settings-grid">
        <label className="field">
          <span>BPM</span>
          <input
            max={160}
            min={50}
            onChange={(event) => update("bpm", Number(event.target.value))}
            type="range"
            value={settings.bpm}
          />
          <strong>{settings.bpm}</strong>
        </label>

        <label className="field">
          <span>拍の数</span>
          <select onChange={handleBeatsChange} value={settings.beatsPerBar}>
            <option value={2}>2拍</option>
            <option value={3}>3拍</option>
            <option value={4}>4拍</option>
            <option value={8}>8拍</option>
          </select>
        </label>

        <label className="field">
          <span>くり返し回数</span>
          <select
            onChange={(event) => update("loops", Number(event.target.value))}
            value={settings.loops}
          >
            <option value={1}>1回</option>
            <option value={2}>2回</option>
            <option value={3}>3回</option>
          </select>
        </label>

        <label className="field">
          <span>入力方法</span>
          <select
            onChange={(event) => update("inputMode", event.target.value as TeacherSettings["inputMode"])}
            value={settings.inputMode}
          >
            <option value="both">{getInputModeLabel("both")}</option>
            <option value="microphone">{getInputModeLabel("microphone")}</option>
            <option value="camera">{getInputModeLabel("camera")}</option>
          </select>
        </label>

        <label className="field">
          <span>判定</span>
          <select
            onChange={(event) => update("difficulty", event.target.value as TeacherSettings["difficulty"])}
            value={settings.difficulty}
          >
            <option value="easy">{getDifficultyLabel("easy")}</option>
            <option value="normal">{getDifficultyLabel("normal")}</option>
            <option value="relaxed">{getDifficultyLabel("relaxed")}</option>
          </select>
        </label>

        <label className="field toggle-field">
          <span>ガイド表示</span>
          <button
            className={settings.showRhythmGuide ? "toggle on" : "toggle"}
            onClick={() => update("showRhythmGuide", !settings.showRhythmGuide)}
            type="button"
          >
            {settings.showRhythmGuide ? "表示する" : "表示しない"}
          </button>
        </label>
      </div>

      <div className="settings-grid secondary">
        <label className="field">
          <span>再生音量</span>
          <input
            max={3}
            min={0}
            onChange={(event) => update("soundVolume", Number(event.target.value))}
            step={0.1}
            type="range"
            value={settings.soundVolume}
          />
          <strong>{Math.round(settings.soundVolume * 100)}%</strong>
        </label>

        <label className="field">
          <span>手拍子の感度</span>
          <input
            max={0.45}
            min={0.06}
            onChange={(event) => update("clapThreshold", Number(event.target.value))}
            step={0.01}
            type="range"
            value={settings.clapThreshold}
          />
          <strong>{settings.clapThreshold.toFixed(2)}</strong>
        </label>

        <label className="field">
          <span>足ぶみの感度</span>
          <input
            max={0.3}
            min={0.04}
            onChange={(event) => update("motionThreshold", Number(event.target.value))}
            step={0.01}
            type="range"
            value={settings.motionThreshold}
          />
          <strong>{settings.motionThreshold.toFixed(2)}</strong>
        </label>
      </div>

      <div className="pattern-editor">
        <div className="pattern-header">
          <h3>譜面パターン</h3>
          <p>ボタンを押すたびに 休符 → 手拍子 → 足ぶみ の順で切り替わります。</p>
        </div>
        <div className="pattern-buttons">
          {settings.pattern.map((step, index) => (
            <button
              className={`pattern-button ${step.action}`}
              key={step.id}
              onClick={() => {
                const pattern: PatternStep[] = settings.pattern.map((current) =>
                  current.id === step.id
                    ? (() => {
                        const nextAction = getNextAction(current.action);
                        return {
                          ...current,
                          action: nextAction,
                          note: nextAction === "rest" ? "rest" : "quarter",
                        };
                      })()
                    : current,
                );
                onChange({ ...settings, pattern });
              }}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{getPatternActionIcon(step.action)}</strong>
              <small>{getPatternActionLabel(step.action)}</small>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
