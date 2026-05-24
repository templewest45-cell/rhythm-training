import { memo } from "react";
import type { PatternStep } from "../types";
import { getNoteSymbol, getPatternActionIcon } from "../utils/rhythm";

type BeatGridProps = {
  caption?: string;
  currentBeat: number;
  pattern: PatternStep[];
  title?: string;
};

const NOTE_POSITION = "48%";
const REST_IMAGE_SRC = "/quarter-rest.png";

type BeatStepProps = {
  index: number;
  isCurrent: boolean;
  step: PatternStep;
};

const BeatStep = memo(function BeatStep({ index, isCurrent, step }: BeatStepProps) {
  const isRest = step.note === "rest";
  const className = [
    "score-step",
    isCurrent ? "is-current" : "",
    isRest ? "is-rest" : `is-${step.action}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="beat-chip">{index + 1}</div>
      <div className="staff-note" style={{ bottom: NOTE_POSITION }}>
        <span className={isRest ? "note-icon note-symbol rest-symbol" : "note-icon note-symbol"} aria-hidden="true">
          {isRest ? <img alt="" src={REST_IMAGE_SRC} /> : getNoteSymbol(step.note)}
        </span>
      </div>
      <div className={isRest ? "action-badge rest-badge" : "action-badge"} aria-hidden="true">
        {isRest ? <img alt="" src={REST_IMAGE_SRC} /> : getPatternActionIcon(step.action)}
      </div>
    </div>
  );
});

export function BeatGrid({ caption = "👏 は手拍子、🦶 は足ぶみ、休符では止まって次を待ちます。", currentBeat, pattern, title = "譜面を見てリズムをまねしよう" }: BeatGridProps) {
  return (
    <div className="score-card">
      <div className="score-header">
        <div>
          <p className="eyebrow">Score</p>
          <h3>{title}</h3>
        </div>
        {caption ? <p className="score-caption">{caption}</p> : null}
      </div>

      <div className="staff-board" role="img" aria-label="五線譜にリズムの音符が並んでいます">
        <div className="staff-lines" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} />
          ))}
        </div>

        <div
          className="score-steps"
          style={{ gridTemplateColumns: `repeat(${pattern.length}, minmax(0, 1fr))` }}
        >
          {pattern.map((step, index) => (
            <BeatStep index={index} isCurrent={currentBeat === index} key={step.id} step={step} />
          ))}
        </div>
      </div>
    </div>
  );
}
