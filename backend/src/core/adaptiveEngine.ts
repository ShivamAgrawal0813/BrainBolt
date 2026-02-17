/**
 * BrainBolt Adaptive Engine — Pure Logic Layer
 *
 * Difficulty range: 1–10
 * Correct → increase difficulty (with stabilizers)
 * Wrong → decrease difficulty (with stabilizers)
 * Prevents ping-pong oscillation.
 * No side effects. No external dependencies. Fully deterministic.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface UserState {
  currentDifficulty: number;
  streak: number;
  maxStreak: number;
  totalScore: number;
  confidence: number;
  performanceWindow: boolean[];
  correctAnswers: number;
  totalAnswers: number;
  lastAnswerAt: number;
}

export interface ScoreBreakdown {
  scoreDelta: number;
  baseScore: number;
  streakMultiplier: number;
  accuracyBonus: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const MIN_DIFFICULTY = 1;
export const MAX_DIFFICULTY = 10;

export const PERFORMANCE_WINDOW_SIZE = 10;
export const MIN_STREAK_FOR_INCREASE = 2;

export const CONFIDENCE_HIGH = 0.7;
export const CONFIDENCE_LOW = 0.3;

export const BASE_SCORE_MULTIPLIER = 10;
export const STREAK_CAP_MULTIPLIER = 2.0;
export const STREAK_BONUS_RATE = 0.1;

export const CONFIDENCE_ALPHA = 0.1;
export const CONFIDENCE_WINDOW_WEIGHT = 0.2;

export const WINDOW_ACCURACY_FOR_INCREASE = 0.6;
export const WINDOW_ACCURACY_FOR_DECREASE = 0.4;

export const ACCURACY_BONUS_THRESHOLD = 0.8;
export const ACCURACY_BONUS_PCT = 0.2;

export const WRONG_ANSWER_PENALTY_MULTIPLIER = 3;

export const STREAK_DECAY_MS = 10 * 60 * 1000; // 10 minutes

// =============================================================================
// PURE HELPER FUNCTIONS
// =============================================================================

/**
 * If inactivity > STREAK_DECAY_MS, streak = floor(streak / 2).
 * Otherwise returns streak unchanged.
 */
export function applyStreakDecay(
  streak: number,
  lastAnswerAt: number,
  now: number
): number {
  const inactiveMs = now - lastAnswerAt;
  if (inactiveMs <= STREAK_DECAY_MS) return streak;
  return Math.floor(streak / 2);
}

/**
 * Correct → streak + 1, Wrong → streak = 0.
 */
export function updateStreak(decayedStreak: number, isCorrect: boolean): number {
  return isCorrect ? decayedStreak + 1 : 0;
}

/**
 * Fixed size array (max PERFORMANCE_WINDOW_SIZE), FIFO.
 * Returns new array; does not mutate input.
 */
export function updatePerformanceWindow(
  window: boolean[],
  isCorrect: boolean
): boolean[] {
  const next = [...window, isCorrect];
  if (next.length <= PERFORMANCE_WINDOW_SIZE) return next;
  return next.slice(-PERFORMANCE_WINDOW_SIZE);
}

/**
 * Proportion of true in window. Returns 0 if window empty.
 */
export function calculateWindowAccuracy(window: boolean[]): number {
  if (window.length === 0) return 0;
  const correct = window.filter(Boolean).length;
  return correct / window.length;
}

/**
 * Exponential smoothing (alpha = 0.1), blend with recent window accuracy (20% weight), clamp 0–1.
 * expectedPerformance at difficulty: 1.0 at diff 1, 0.1 at diff 10 (linear).
 */
export function updateConfidence(
  currentConfidence: number,
  difficulty: number,
  isCorrect: boolean,
  windowAccuracy: number
): number {
  const expectedPerformance = Math.max(
    0,
    1 - (difficulty - 1) * 0.1
  );
  const actual = isCorrect ? 1 : 0;
  const error = actual - expectedPerformance;
  const smoothed = currentConfidence + CONFIDENCE_ALPHA * error;
  const blended =
    (1 - CONFIDENCE_WINDOW_WEIGHT) * smoothed +
    CONFIDENCE_WINDOW_WEIGHT * windowAccuracy;
  return Math.max(0, Math.min(1, blended));
}

/**
 * Prevents ping-pong. Increase only if confidence ≥ 0.7, streak ≥ 2, windowAccuracy ≥ 0.6.
 * Decrease only if confidence ≤ 0.3, windowAccuracy ≤ 0.4.
 * Clamp 1–10.
 */
export function updateDifficulty(
  currentDifficulty: number,
  isCorrect: boolean,
  confidence: number,
  windowAccuracy: number,
  streak: number
): number {
  let direction: number;
  if (isCorrect) {
    if (
      confidence >= CONFIDENCE_HIGH &&
      streak >= MIN_STREAK_FOR_INCREASE &&
      windowAccuracy >= WINDOW_ACCURACY_FOR_INCREASE
    ) {
      direction = 1;
    } else {
      direction = 0;
    }
  } else {
    if (
      confidence <= CONFIDENCE_LOW &&
      windowAccuracy <= WINDOW_ACCURACY_FOR_DECREASE
    ) {
      direction = -1;
    } else {
      direction = 0;
    }
  }

  const next = currentDifficulty + direction;
  return Math.max(
    MIN_DIFFICULTY,
    Math.min(MAX_DIFFICULTY, next)
  );
}

/**
 * Uses difficultyUsedForQuestion (state.currentDifficulty BEFORE update).
 * Wrong: -Math.round(difficulty * 3).
 * Correct: base = difficulty * 10, multiplier = min(1 + streak * 0.1, 2.0),
 * accuracyBonus = +20% of base if windowAccuracy ≥ 0.8, final = base * multiplier + accuracyBonus.
 * Returns integer.
 */
export function calculateScore(
  difficultyUsedForQuestion: number,
  isCorrect: boolean,
  streakAtAnswer: number,
  windowAccuracy: number
): ScoreBreakdown {
  const baseScore = difficultyUsedForQuestion * BASE_SCORE_MULTIPLIER;

  if (!isCorrect) {
    const penalty = Math.round(
      difficultyUsedForQuestion * WRONG_ANSWER_PENALTY_MULTIPLIER
    );
    return {
      scoreDelta: -penalty,
      baseScore,
      streakMultiplier: 1,
      accuracyBonus: 0,
    };
  }

  const streakMultiplier = Math.min(
    1 + streakAtAnswer * STREAK_BONUS_RATE,
    STREAK_CAP_MULTIPLIER
  );
  const withStreak = baseScore * streakMultiplier;
  const accuracyBonus =
    windowAccuracy >= ACCURACY_BONUS_THRESHOLD
      ? Math.round(baseScore * ACCURACY_BONUS_PCT)
      : 0;
  const scoreDelta = Math.round(withStreak + accuracyBonus);

  return {
    scoreDelta,
    baseScore,
    streakMultiplier,
    accuracyBonus,
  };
}

// =============================================================================
// MAIN: processAnswer
// =============================================================================

/**
 * Process one answer. Fully immutable; does not mutate input state.
 *
 * Order: streak decay → update streak → update window → window accuracy →
 * update confidence → update difficulty → calculate score (using OLD difficulty) →
 * update totals → return new state.
 *
 * NOTE: calculateScore may return a negative scoreDelta for wrong answers
 * (penalty). The returned UserState must never allow totalScore to drop
 * below zero because the persistent store enforces `total_score >= 0`.
 * Therefore we apply a clamp only to the final `totalScore` field here
 * (Math.max(0, ...)). We do NOT modify `scoreDelta` itself so the penalty
 * remains auditable and deterministic.
 */
export function processAnswer(
  state: UserState,
  isCorrect: boolean,
  now: number
): UserState {
  const decayedStreak = applyStreakDecay(
    state.streak,
    state.lastAnswerAt,
    now
  );
  const newStreak = updateStreak(decayedStreak, isCorrect);
  const newMaxStreak = Math.max(state.maxStreak, newStreak);

  const newWindow = updatePerformanceWindow(state.performanceWindow, isCorrect);
  const windowAccuracy = calculateWindowAccuracy(newWindow);

  const newConfidence = updateConfidence(
    state.confidence,
    state.currentDifficulty,
    isCorrect,
    windowAccuracy
  );

  const newDifficulty = updateDifficulty(
    state.currentDifficulty,
    isCorrect,
    newConfidence,
    windowAccuracy,
    newStreak
  );

  // Streak at time of this answer (for scoring)
  const streakAtAnswer = isCorrect ? newStreak - 1 : 0;
  const { scoreDelta } = calculateScore(
    state.currentDifficulty, // OLD difficulty
    isCorrect,
    streakAtAnswer,
    windowAccuracy
  );

  // IMPORTANT: clamp totalScore at 0 to satisfy DB constraint while keeping
  // the scoreDelta unchanged for auditing and downstream logic.
  const clampedTotal = Math.max(0, state.totalScore + scoreDelta);

  return {
    currentDifficulty: newDifficulty,
    streak: newStreak,
    maxStreak: newMaxStreak,
    totalScore: clampedTotal,
    confidence: newConfidence,
    performanceWindow: newWindow,
    correctAnswers: state.correctAnswers + (isCorrect ? 1 : 0),
    totalAnswers: state.totalAnswers + 1,
    lastAnswerAt: now,
  };
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create initial state for a new user.
 */
export function createInitialState(now: number): UserState {
  return {
    currentDifficulty: 5,
    streak: 0,
    maxStreak: 0,
    totalScore: 0,
    confidence: 0.5,
    performanceWindow: [],
    correctAnswers: 0,
    totalAnswers: 0,
    lastAnswerAt: now,
  };
}
