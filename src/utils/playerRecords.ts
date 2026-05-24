import type { BeatCount, EvaluationSummary } from "../types";

const STORAGE_KEY = "rhythm-dojo-players";

export type PlayerRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  attempts: RhythmAttempt[];
};

export type RhythmAttempt =
  | {
      id: string;
      mode: "basic-rhythm";
      playedAt: string;
      meter: BeatCount;
      levelId: string;
      levelTitle: string;
      phraseIndex: number;
      onTime: number;
      early: number;
      late: number;
      misses: number;
      totalExpected: number;
      cleared: boolean;
    }
  | {
      id: string;
      mode: "copy-rhythm";
      playedAt: string;
      meter: BeatCount;
      barCount: number;
      onTime: number;
      misses: number;
      totalExpected: number;
      cleared: boolean;
    }
  | {
      id: string;
      mode: "listen-copy";
      playedAt: string;
      meter: BeatCount;
      barCount: number;
      onTime: number;
      early: number;
      late: number;
      misses: number;
      totalExpected: number;
      cleared: boolean;
    };

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const normalizePlayers = (value: unknown): PlayerRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is PlayerRecord => Boolean(item && typeof item === "object" && "id" in item && "name" in item))
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
      attempts: Array.isArray(item.attempts) ? (item.attempts as RhythmAttempt[]) : [],
    }));
};

export const loadPlayers = (): PlayerRecord[] => {
  try {
    return normalizePlayers(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
};

export const savePlayers = (players: PlayerRecord[]) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
};

export const createPlayer = (name: string): PlayerRecord => {
  const now = new Date().toISOString();
  return {
    id: createId(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
    attempts: [],
  };
};

export const createAttemptId = createId;

export const isBasicCleared = (summary: EvaluationSummary, misses: number) =>
  summary.totalExpected > 0 && misses === 0 && summary.early === 0 && summary.late === 0 && summary.onTime === summary.totalExpected;
