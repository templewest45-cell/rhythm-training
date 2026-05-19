import type { PatternStep } from "../types";
import { getNoteSymbol, getPatternActionIcon } from "../utils/rhythm";

type BeatGridProps = {
  currentBeat: number;
  pattern: PatternStep[];
};

const NOTE_POSITION = "48%";

export function BeatGrid({ currentBeat, pattern }: BeatGridProps) {
  return (
    <div className="score-card">
      <div className="score-header">
        <div>
          <p className="eyebrow">Score</p>
          <h3>譜面を見てリズムをまねしよう</h3>
        </div>
        <p className="score-caption">👏 は手拍子、🦶 は足ぶみ、休符では止まって次を待ちます。</p>
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
          {pattern.map((step, index) => {
            const isCurrent = currentBeat === index;
            const isRest = step.note === "rest";
            const className = [
              "score-step",
              isCurrent ? "is-current" : "",
              isRest ? "is-rest" : `is-${step.action}`,
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <div className={className} key={step.id}>
                <div className="beat-chip">{index + 1}</div>
                <div className="staff-note" style={{ bottom: NOTE_POSITION }}>
                  <span className="note-icon note-symbol" aria-hidden="true">
                    {getNoteSymbol(step.note)}
                  </span>
                </div>
                <div className="action-badge" aria-hidden="true">
                  {getPatternActionIcon(step.action)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
