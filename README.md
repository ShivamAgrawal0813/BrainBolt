# BrainBolt - Adaptive Infinite Quiz Platform

## 🚀 Overview
**BrainBolt** is a real-time adaptive infinite quiz system that serves one question at a time, dynamically adjusting difficulty (1-10) based on user performance. It features a stabilized difficulty algorithm, streak-based scoring, and live leaderboards.

---

## 🏗 Architecture & Tech Stack

- **Frontend**: Next.js 13+ (App Router), TypeScript, Tailwind CSS (Design System Tokens).
- **Backend**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL 15 (Single Source of Truth).
- **Cache**: Redis 7 (User State, Question Pools, Sorted Sets for Leaderboards).
- **Infrastructure**: Docker & Docker Compose.

---

## 🧠 Adaptive Algorithm Implementation

To prevent "ping-pong" instability (rapid difficulty oscillation), the system uses a **stabilized adaptive engine**:
1.  **Confidence Score**: Difficulty only changes when statistical confidence > 0.7.
2.  **Rolling Performance Window**: Analyzes accuracy over the last 10 questions.
3.  **Minimum Streak**: Difficulty increase requires a streak of ≥ 2 correct answers.
4.  **Hysteresis**: Buffer zones prevent immediate flip-flopping.

---

## 🔥 Scoring & Streak System

- **Scoring**: `Base Score (Difficulty * 10) × Streak Multiplier + Accuracy Bonus`.
- **Streak Multiplier**: Starts at 1.0x, increments by 0.1x per correct answer, capped at **2.0x**.
- **Reset**: Wrong answers reset streak to 0.
- **Decay**: Streak decays after 10 minutes of inactivity.
- **Edge Cases**: Non-negative scores guaranteed.

---

## 📊 Live Leaderboards

Real-time leaderboards powered by Redis Sorted Sets (`ZSET`), synchronized periodically with PostgreSQL.
- **Total Score**: Global ranking by cumulative points.
- **Max Streak**: Global ranking by highest achieved streak.

---

## 🛡 Edge Cases Handled

1.  **Ping-Pong Instability**: Solved via rolling window & confidence thresholds.
2.  **Idempotency**: `Answer-Idempotency-Key` prevents duplicate submissions for the same question.
3.  **Concurrency**: Optimistic locking via `stateVersion` ensures atomic state updates.
4.  **Race Conditions**: Redis/DB consistency managed via transactional writes.

---

## 📦 Data Model

- **`users`**: User identity & authentication.
- **`questions`**: Difficulty (1-10), buckets, active status.
- **`user_state`**: Current difficulty, streak, score, version (Optimistic Locking).
- **`answer_log`**: Historical performance for analytics.
- **`leaderboard_score` / `leaderboard_streak`**: Materialized rankings.

---

## ⚡ API Design

### `GET /v1/quiz/next`
Returns next question based on current difficulty.
- **Response**: `questionId`, `difficulty`, `prompt`, `choices`, `sessionId`, `stateVersion`.

### `POST /v1/quiz/answer`
Submits answer with idempotency check.
- **Request**: `userId`, `questionId`, `answer`, `stateVersion`, `answerIdempotencyKey`.
- **Response**: `correct`, `newDifficulty`, `newStreak`, `scoreDelta`, `leaderboardRank`.

### `GET /v1/quiz/metrics`
Returns user performance stats (difficulty histogram, recent trend).

---

## 🐳 Running the Project

The entire stack (Frontend, Backend, Database, Redis) is containerized.

### Prerequisites
- Docker & Docker Compose

### Start Application
```bash
docker-compose up -d
```
*Frontend available at `http://localhost:3000`, Backend at `http://localhost:4000`.*

### Stop Application
```bash
docker-compose down
```

---

## 🎥 Demo Video

[[Link to Demo Video](https://drive.google.com/file/d/1eEwgZ1zlfv6I86cS3EZUx4AaJKGwIOeE/view?usp=sharing)] - *Walkthrough of features, codebase, and adaptive engine behavior.*
