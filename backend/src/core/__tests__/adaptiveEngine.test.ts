import {
  createInitialState,
  processAnswer,
  applyStreakDecay,
  updateStreak,
  updatePerformanceWindow,
  calculateWindowAccuracy,
  updateConfidence,
  updateDifficulty,
  calculateScore,
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
  STREAK_DECAY_MS,
  type UserState,
} from '../adaptiveEngine';
/// <reference types="jest" />
// =============================================================================
// HELPERS
// =============================================================================

function state(overrides: Partial<UserState> = {}): UserState {
  return {
    currentDifficulty: 5,
    streak: 0,
    maxStreak: 0,
    totalScore: 0,
    confidence: 0.5,
    performanceWindow: [],
    correctAnswers: 0,
    totalAnswers: 0,
    lastAnswerAt: 0,
    ...overrides,
  };
}

// =============================================================================
// BASIC BEHAVIOR
// =============================================================================

describe('Basic behavior', () => {
  it('correct answer increases streak', () => {
    const s = state({ streak: 2 });
    const next = processAnswer(s, true, 1000);
    expect(next.streak).toBe(3);
  });

  it('wrong answer resets streak', () => {
    const s = state({ streak: 5 });
    const next = processAnswer(s, false, 1000);
    expect(next.streak).toBe(0);
  });

  it('maxStreak updates correctly when streak exceeds it', () => {
    const s = state({ streak: 3, maxStreak: 3 });
    const next = processAnswer(s, true, 1000);
    expect(next.maxStreak).toBe(4);
  });

  it('maxStreak does not decrease', () => {
    const s = state({ streak: 1, maxStreak: 10 });
    const next = processAnswer(s, false, 1000);
    expect(next.maxStreak).toBe(10);
  });

  it('score increases on correct', () => {
    const s = state({ totalScore: 100, currentDifficulty: 5 });
    const next = processAnswer(s, true, 1000);
    expect(next.totalScore).toBeGreaterThan(100);
  });

  it('score decreases on wrong', () => {
    const s = state({ totalScore: 100, currentDifficulty: 5 });
    const next = processAnswer(s, false, 1000);
    expect(next.totalScore).toBeLessThan(100);
  });

  it('correctAnswers increments on correct', () => {
    const s = state({ correctAnswers: 2, totalAnswers: 2 });
    const next = processAnswer(s, true, 1000);
    expect(next.correctAnswers).toBe(3);
    expect(next.totalAnswers).toBe(3);
  });

  it('correctAnswers unchanged on wrong', () => {
    const s = state({ correctAnswers: 2, totalAnswers: 2 });
    const next = processAnswer(s, false, 1000);
    expect(next.correctAnswers).toBe(2);
    expect(next.totalAnswers).toBe(3);
  });
});

// =============================================================================
// BOUNDARY CONDITIONS
// =============================================================================

describe('Boundary conditions', () => {
  it('difficulty never exceeds 10', () => {
    let s = state({ currentDifficulty: 10, streak: 5, confidence: 0.9, performanceWindow: Array(10).fill(true) });
    for (let i = 0; i < 5; i++) {
      s = processAnswer(s, true, 1000 + i);
    }
    expect(s.currentDifficulty).toBeLessThanOrEqual(MAX_DIFFICULTY);
    expect(s.currentDifficulty).toBe(10);
  });

  it('difficulty never below 1', () => {
    let s = state({ currentDifficulty: 1, streak: 0, confidence: 0.2, performanceWindow: Array(10).fill(false) });
    for (let i = 0; i < 5; i++) {
      s = processAnswer(s, false, 1000 + i);
    }
    expect(s.currentDifficulty).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
    expect(s.currentDifficulty).toBe(1);
  });

  it('repeated correct at 10 stays 10', () => {
    let s = state({ currentDifficulty: 10, streak: 3, confidence: 0.8, performanceWindow: Array(10).fill(true) });
    s = processAnswer(s, true, 1000);
    s = processAnswer(s, true, 2000);
    expect(s.currentDifficulty).toBe(10);
  });

  it('repeated wrong at 1 stays 1', () => {
    let s = state({ currentDifficulty: 1, streak: 0, confidence: 0.2, performanceWindow: Array(10).fill(false) });
    s = processAnswer(s, false, 1000);
    s = processAnswer(s, false, 2000);
    expect(s.currentDifficulty).toBe(1);
  });

  it('difficulty stays in [1,10] after many steps', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 50; i++) {
      s = processAnswer(s, i % 3 !== 0, 1000 + i * 100);
    }
    expect(s.currentDifficulty).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
    expect(s.currentDifficulty).toBeLessThanOrEqual(MAX_DIFFICULTY);
  });
});

// =============================================================================
// PING-PONG STABILITY
// =============================================================================

describe('Ping-pong stability', () => {
  it('alternating T F T F T F T F keeps difficulty stable', () => {
    let s = state({ currentDifficulty: 5, streak: 0, confidence: 0.5, performanceWindow: [] });
    const results: number[] = [s.currentDifficulty];
    const pattern = [true, false, true, false, true, false, true, false];
    for (let i = 0; i < pattern.length; i++) {
      s = processAnswer(s, pattern[i]!, 1000 + i);
      results.push(s.currentDifficulty);
    }
    // Difficulty should not oscillate wildly; allow small moves or no move
    const maxChange = Math.max(...results) - Math.min(...results);
    expect(maxChange).toBeLessThanOrEqual(2);
  });

  it('alternating pattern does not push difficulty to extremes', () => {
    let s = state({ currentDifficulty: 5, confidence: 0.5 });
    for (let i = 0; i < 20; i++) {
      s = processAnswer(s, i % 2 === 0, 1000 + i);
    }
    expect(s.currentDifficulty).toBeGreaterThanOrEqual(1);
    expect(s.currentDifficulty).toBeLessThanOrEqual(10);
  });
});

// =============================================================================
// STREAK REQUIREMENT
// =============================================================================

describe('Streak requirement', () => {
  it('single correct should NOT increase difficulty (streak 1)', () => {
    const s = state({ currentDifficulty: 5, streak: 0, confidence: 0.8, performanceWindow: [true, true, true, true, true, true, true, true, true, true] });
    const next = processAnswer(s, true, 1000);
    expect(next.streak).toBe(1);
    expect(next.currentDifficulty).toBe(5);
  });

  it('two correct in a row with high confidence can increase difficulty', () => {
    let s = state({ currentDifficulty: 5, streak: 0, confidence: 0.75, performanceWindow: Array(10).fill(true) });
    s = processAnswer(s, true, 1000); // streak 1
    s = processAnswer(s, true, 2000); // streak 2
    expect(s.streak).toBe(2);
    expect(s.currentDifficulty).toBeGreaterThanOrEqual(5);
  });
});

// =============================================================================
// ROLLING WINDOW
// =============================================================================

describe('Rolling window', () => {
  it('window has max 10 elements', () => {
    let s = state({ performanceWindow: [] });
    for (let i = 0; i < 15; i++) {
      s = processAnswer(s, true, 1000 + i);
    }
    expect(s.performanceWindow.length).toBeLessThanOrEqual(10);
  });

  it('calculateWindowAccuracy returns 0 for empty window', () => {
    expect(calculateWindowAccuracy([])).toBe(0);
  });

  it('calculateWindowAccuracy returns correct proportion', () => {
    expect(calculateWindowAccuracy([true, true, false])).toBeCloseTo(2 / 3);
    expect(calculateWindowAccuracy([true, true, true, true])).toBe(1);
  });

  it('updatePerformanceWindow is FIFO', () => {
    const w = [true, false, true];
    const next = updatePerformanceWindow(w, false);
    expect(next).toEqual([true, false, true, false]);
  });

  it('low recent accuracy blocks difficulty increase', () => {
    let s = state({
      currentDifficulty: 5,
      streak: 3,
      confidence: 0.8,
      performanceWindow: [false, false, true, false, false, true, false, false, true, false],
    });
    const next = processAnswer(s, true, 1000);
    expect(calculateWindowAccuracy(next.performanceWindow)).toBeLessThan(0.6);
    expect(next.currentDifficulty).toBe(5);
  });
});

// =============================================================================
// CONFIDENCE THRESHOLDS
// =============================================================================

describe('Confidence thresholds', () => {
  it('confidence above 0.7 with streak and window allows increase', () => {
    let s = state({
      currentDifficulty: 5,
      streak: 0,
      confidence: 0.75,
      performanceWindow: Array(10).fill(true),
    });
    s = processAnswer(s, true, 1000);
    s = processAnswer(s, true, 2000);
    expect(s.currentDifficulty).toBeGreaterThanOrEqual(5);
  });

  it('confidence below 0.3 with low window allows decrease', () => {
    let s = state({
      currentDifficulty: 5,
      streak: 0,
      confidence: 0.25,
      performanceWindow: Array(10).fill(false),
    });
    const next = processAnswer(s, false, 1000);
    expect(next.currentDifficulty).toBeLessThanOrEqual(5);
  });

  it('confidence stays in [0,1]', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 30; i++) {
      s = processAnswer(s, i % 2 === 0, 1000 + i);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

// =============================================================================
// INACTIVITY DECAY
// =============================================================================

describe('Inactivity decay', () => {
  it('streak halves after 10+ minutes inactivity', () => {
    const s = state({ streak: 6, lastAnswerAt: 0 });
    const now = STREAK_DECAY_MS + 1;
    const decayed = applyStreakDecay(s.streak, s.lastAnswerAt, now);
    expect(decayed).toBe(3);
  });

  it('streak unchanged if inactive under 10 minutes', () => {
    const s = state({ streak: 5, lastAnswerAt: 1000 });
    const now = 1000 + STREAK_DECAY_MS - 1;
    const decayed = applyStreakDecay(s.streak, s.lastAnswerAt, now);
    expect(decayed).toBe(5);
  });

  it('processAnswer applies decay then updates streak', () => {
    const s = state({
      streak: 4,
      lastAnswerAt: 0,
      performanceWindow: [],
    });
    const now = STREAK_DECAY_MS + 1; // 4 -> 2
    const next = processAnswer(s, true, now);
    expect(next.streak).toBe(3); // 2 + 1
  });

  it('decay floor: streak 1 after long inactivity becomes 0', () => {
    const decayed = applyStreakDecay(1, 0, STREAK_DECAY_MS + 1);
    expect(decayed).toBe(0);
  });
});

// =============================================================================
// PURE HELPERS
// =============================================================================

describe('Pure helpers', () => {
  it('updateStreak correct adds 1', () => {
    expect(updateStreak(0, true)).toBe(1);
    expect(updateStreak(3, true)).toBe(4);
  });

  it('updateStreak wrong resets to 0', () => {
    expect(updateStreak(5, false)).toBe(0);
  });

  it('updateDifficulty clamps to 1-10', () => {
    expect(updateDifficulty(10, true, 0.9, 0.9, 5)).toBeLessThanOrEqual(10);
    expect(updateDifficulty(1, false, 0.1, 0.1, 0)).toBeGreaterThanOrEqual(1);
  });
});

// =============================================================================
// SCORE FORMULA
// =============================================================================

describe('Score formula integrity', () => {
  it('wrong answer penalty is difficulty * 3', () => {
    const r = calculateScore(5, false, 0, 0);
    expect(r.scoreDelta).toBe(-15);
  });

  it('correct uses multiplicative streak', () => {
    const r = calculateScore(5, true, 3, 0.5);
    expect(r.streakMultiplier).toBe(1.3);
    expect(r.baseScore).toBe(50);
    expect(r.scoreDelta).toBeGreaterThan(50);
  });

  it('streak multiplier capped at 2.0', () => {
    const r = calculateScore(5, true, 15, 0.5);
    expect(r.streakMultiplier).toBe(2);
  });

  it('accuracy bonus additive when windowAccuracy >= 0.8', () => {
    const r = calculateScore(10, true, 0, 0.9);
    expect(r.accuracyBonus).toBe(20); // 20% of 100
  });

  it('accuracy bonus 0 when windowAccuracy < 0.8', () => {
    const r = calculateScore(10, true, 0, 0.7);
    expect(r.accuracyBonus).toBe(0);
  });

  it('score uses difficultyUsedForQuestion not new difficulty', () => {
    const s = state({ currentDifficulty: 7, streak: 2 });
    const next = processAnswer(s, true, 1000);
    const expectedBase = 7 * 10;
    expect(next.totalScore).toBeGreaterThanOrEqual(expectedBase);
  });
});

// =============================================================================
// DETERMINISM
// =============================================================================

describe('Determinism', () => {
  it('same inputs produce same result', () => {
    const s = state({ currentDifficulty: 5, streak: 2, confidence: 0.6, performanceWindow: [true, false, true] });
    const a = processAnswer(s, true, 1000);
    const b = processAnswer(s, true, 1000);
    expect(a).toEqual(b);
  });

  it('same inputs produce same result (wrong)', () => {
    const s = state({ currentDifficulty: 5, streak: 2 });
    const a = processAnswer(s, false, 2000);
    const b = processAnswer(s, false, 2000);
    expect(a).toEqual(b);
  });

  it('input state is not mutated', () => {
    const s = state({ currentDifficulty: 5, streak: 1, totalScore: 100 });
    const snap = JSON.stringify(s);
    processAnswer(s, true, 1000);
    expect(JSON.stringify(s)).toBe(snap);
  });
});

// =============================================================================
// LONG SIMULATION INVARIANTS
// =============================================================================

describe('Long simulation invariants', () => {
  it('100-answer deterministic sequence keeps difficulty in [1,10]', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 100; i++) {
      s = processAnswer(s, i % 3 !== 0, 1000 + i);
      expect(s.currentDifficulty).toBeGreaterThanOrEqual(MIN_DIFFICULTY);
      expect(s.currentDifficulty).toBeLessThanOrEqual(MAX_DIFFICULTY);
    }
  });

  it('100-answer sequence keeps confidence in [0,1]', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 100; i++) {
      s = processAnswer(s, i % 3 !== 0, 1000 + i);
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('100-answer sequence keeps streak >= 0', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 100; i++) {
      s = processAnswer(s, i % 2 === 0, 1000 + i);
      expect(s.streak).toBeGreaterThanOrEqual(0);
    }
  });

  it('100-answer sequence keeps performanceWindow length <= 10', () => {
    let s = createInitialState(0);
    for (let i = 0; i < 100; i++) {
      s = processAnswer(s, true, 1000 + i);
      expect(s.performanceWindow.length).toBeLessThanOrEqual(10);
    }
  });
});

// =============================================================================
// createInitialState
// =============================================================================

describe('createInitialState', () => {
  it('returns valid initial state', () => {
    const s = createInitialState(12345);
    expect(s.currentDifficulty).toBe(5);
    expect(s.streak).toBe(0);
    expect(s.maxStreak).toBe(0);
    expect(s.totalScore).toBe(0);
    expect(s.confidence).toBe(0.5);
    expect(s.performanceWindow).toEqual([]);
    expect(s.correctAnswers).toBe(0);
    expect(s.totalAnswers).toBe(0);
    expect(s.lastAnswerAt).toBe(12345);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge cases', () => {
  it('first answer correct does not increase difficulty (streak 1)', () => {
    const s = createInitialState(0);
    const next = processAnswer(s, true, 1000);
    expect(next.currentDifficulty).toBe(5);
    expect(next.streak).toBe(1);
  });

  it('first answer wrong may decrease difficulty', () => {
    const s = createInitialState(0);
    const next = processAnswer(s, false, 1000);
    expect(next.currentDifficulty).toBeLessThanOrEqual(5);
  });

  it('totalScore can be reduced but is clamped to 0 (never negative)', () => {
    // start with small totalScore and apply a strong penalty (high difficulty)
    let s = state({ currentDifficulty: 10, totalScore: 5 });

    // calculateScore would return a negative delta for wrong answers at high difficulty
    const penalty = calculateScore(10, false, 0, 0).scoreDelta;
    expect(penalty).toBeLessThan(0);

    // apply a wrong answer that would take the total below 0
    s = processAnswer(s, false, 1000);
    // totalScore must be clamped to 0 and never negative
    expect(s.totalScore).toBeGreaterThanOrEqual(0);
    expect(s.totalScore).toBe(0);
  });

  it('performanceWindow grows then stays at 10', () => {
    let s = state({ performanceWindow: [] });
    const lengths: number[] = [];
    for (let i = 0; i < 15; i++) {
      s = processAnswer(s, true, 1000 + i);
      lengths.push(s.performanceWindow.length);
    }
    expect(lengths.slice(-5)).toEqual([10, 10, 10, 10, 10]);
  });
});
