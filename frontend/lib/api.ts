/**
 * API Client
 * Axios-based API client with auth interceptors
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AuthResponse,
  QuestionResponse,
  AnswerResponse,
  LeaderboardResponse,
  MetricsResponse,
} from '@/types/api';

class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001') {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Attach auth token to every request
    this.client.interceptors.request.use((config) => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Handle 401 → redirect to login
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/v1/auth/login', { email, password });
    return data;
  }

  async register(email: string, password: string, username: string): Promise<AuthResponse> {
    const { data } = await this.client.post<AuthResponse>('/v1/auth/register', { email, password, username });
    return data;
  }

  // ── Quiz ─────────────────────────────────────────────────────────────────────

  async getNextQuestion(): Promise<QuestionResponse> {
    const { data } = await this.client.get<QuestionResponse>('/v1/quiz/next');
    return data;
  }

  async submitAnswer(
    questionId: string,
    userAnswer: string,
    stateVersion: number,
    idempotencyKey: string
  ): Promise<AnswerResponse> {
    const { data } = await this.client.post<AnswerResponse>(
      '/v1/quiz/answer',
      { questionId, userAnswer, stateVersion },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    return data;
  }

  // ── Metrics ──────────────────────────────────────────────────────────────────

  async getMetrics(): Promise<MetricsResponse> {
    const { data } = await this.client.get<MetricsResponse>('/v1/quiz/metrics');
    return data;
  }

  // ── Leaderboard ──────────────────────────────────────────────────────────────

  async getLeaderboardScore(limit: number = 10): Promise<LeaderboardResponse> {
    const { data } = await this.client.get<LeaderboardResponse>('/v1/leaderboard/score', {
      params: { limit },
    });
    return data;
  }

  async getLeaderboardStreak(limit: number = 10): Promise<LeaderboardResponse> {
    const { data } = await this.client.get<LeaderboardResponse>('/v1/leaderboard/streak', {
      params: { limit },
    });
    return data;
  }
}

export const apiClient = new ApiClient();
