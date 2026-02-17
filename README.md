# BrainBolt  
**Adaptive Infinite Quiz Platform**

BrainBolt is a real-time adaptive infinite quiz system that dynamically adjusts question difficulty based on user performance while maintaining strong consistency, live leaderboards, and idempotent answer handling.

---

## 🚀 Overview

BrainBolt serves **exactly one question at a time** and adapts difficulty using a stabilized algorithm that prevents oscillation and ensures fair progression.

Core principles:

- Adaptive difficulty (range 1–10)
- Streak-based scoring system
- Real-time leaderboard updates
- Strong per-user consistency
- Redis-backed caching
- Fully Dockerized infrastructure

---

## 🧠 Adaptive Algorithm

The adaptive engine is implemented as a **pure deterministic logic layer**.

### Difficulty Behavior

- Correct answer → difficulty may increase
- Wrong answer → difficulty may decrease
- Always clamped between 1 and 10

### Ping-Pong Prevention

To prevent oscillation between adjacent difficulty levels, the system uses:

- Confidence score (0–1)
- Rolling performance window (last 10 answers)
- Minimum streak requirement
- Hysteresis thresholds

Difficulty increases only when:

- Confidence ≥ 0.7  
- Streak ≥ 2  
- Window accuracy ≥ 60%

Difficulty decreases only when:

- Confidence ≤ 0.3  
- Window accuracy ≤ 40%

---

## 🔥 Streak System

- Streak increments on correct answers
- Streak resets on incorrect answers
- Streak decays by 50% after 10 minutes of inactivity
- Streak multiplier affects scoring
- Multiplier capped at 2.0

---

## 🧮 Scoring Model

Score incorporates:

- Difficulty weight
- Streak multiplier
- Accuracy bonus
- Wrong answer penalty

### Correct Answer

```
Base Score = difficulty × 10
Streak Multiplier = min(1 + streak × 0.1, 2.0)
Accuracy Bonus = +20% of base if rolling accuracy ≥ 80%
Final Score = base × multiplier + bonus
```

### Wrong Answer

```
Penalty = difficulty × 3
```

Total score is clamped at ≥ 0 to maintain data integrity.

---

## 📊 Live Leaderboards

Two real-time leaderboards:

1. Total Score Leaderboard
2. Max Streak Leaderboard

Leaderboards update immediately after every answer submission.

---

## 🏗 Tech Stack

**Frontend**
- Next.js 13+
- React
- TypeScript
- Tailwind CSS

**Backend**
- Node.js
- TypeScript

**Database**
- PostgreSQL 15

**Cache**
- Redis 7

**Infrastructure**
- Docker
- Docker Compose

---

## 📦 Data Model

```
users
questions
user_state
answer_log
leaderboard_score
leaderboard_streak
```

Key guarantees:

- Optimistic locking via `stateVersion`
- Idempotent answer submission
- Atomic score + streak updates
- Strong per-user consistency

---

## 🔄 API Design

### GET /v1/quiz/next

Response:
- questionId
- difficulty
- prompt
- choices
- sessionId
- stateVersion
- currentScore
- currentStreak

---

### POST /v1/quiz/answer

Request:
- userId
- sessionId
- questionId
- answer
- stateVersion
- answerIdempotencyKey

Response:
- correct
- newDifficulty
- newStreak
- scoreDelta
- totalScore
- stateVersion
- leaderboardRankScore
- leaderboardRankStreak

---

### GET /v1/quiz/metrics

Response:
- currentDifficulty
- streak
- maxStreak
- totalScore
- accuracy
- recentPerformance

---

### GET /v1/leaderboard/score
### GET /v1/leaderboard/streak

Returns top N users.

---

## ⚡ Caching Strategy

Redis is used for:

- User state caching
- Question pools per difficulty
- Leaderboard sorted sets

Strategy:

- Read-through caching
- Immediate invalidation after answer submission
- TTL where appropriate
- Real-time leaderboard updates via sorted sets

---

## 🐳 Running the Project

Start entire stack:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f
```

Stop services:

```bash
docker-compose down
```

---

## 📁 Project Structure

```
backend/
  src/
    adaptive-engine/
    db/
    api/
docs/
docker-compose.yml
```

Design documentation includes:

- Architecture
- Database schema
- Adaptive algorithm pseudocode
- Leaderboard strategy
- Caching strategy
- State management
- Answer submission flow

---

## 🛡 Edge Cases Handled

- Streak reset on wrong answer
- Streak decay after inactivity
- Difficulty boundary protection (1–10)
- Duplicate answer submission (idempotency)
- Score never drops below zero
- Ping-pong oscillation prevention
- Concurrency conflicts via optimistic locking

---

## 🏁 Status

- Adaptive engine implemented
- Backend infrastructure complete
- Docker environment configured
- Frontend integration in progress
