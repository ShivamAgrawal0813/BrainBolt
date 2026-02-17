/**
 * API Types — aligned with backend response shapes
 */

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  username: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  username: string;
}

// ─── Quiz ──────────────────────────────────────────────────────────────────────

export interface QuestionResponse {
  questionId: string;
  difficulty: number;
  prompt: string;
  choices: string[];
  sessionId: string;
  stateVersion: number;
  currentScore: number;
  currentStreak: number;
}

export interface AnswerRequest {
  questionId: string;
  userAnswer: string;
  stateVersion: number;
}

export interface AnswerResponse {
  correct: boolean;
  newDifficulty: number;
  newStreak: number;
  scoreDelta: number;
  totalScore: number;
  stateVersion: number;
  leaderboardRankScore: number;
  leaderboardRankStreak: number;
}

// ─── Leaderboard ───────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  userId: string;
  totalScore?: number;
  maxStreak?: number;
  rank?: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

// ─── Metrics ───────────────────────────────────────────────────────────────────

export interface DifficultyHistogramItem {
  difficulty: number;
  answered: number;
  correct: number;
  accuracy: number;
}

export interface MetricsResponse {
  currentDifficulty: number;
  streak: number;
  maxStreak: number;
  totalScore: number;
  accuracy: number;
  difficultyHistogram: DifficultyHistogramItem[];
  recentPerformance: {
    last10Answers: {
      correct: number;
      accuracy: number;
      trend: 'improving' | 'declining' | 'stable';
    };
  };
}
