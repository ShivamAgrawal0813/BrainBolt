# BrainBolt
Adaptive Infinite Quiz Platform

## 📋 Project Status

**Design Phase Complete** ✅

This project is currently in the design phase. All architecture, database schema, algorithms, and system designs have been completed and documented.

## 📚 Design Documentation

Comprehensive design documents are available in the `docs/` directory:

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - High-level and low-level system architecture
- **[DATABASE_SCHEMA.sql](docs/DATABASE_SCHEMA.sql)** - Complete PostgreSQL database schema
- **[ALGORITHMS.md](docs/ALGORITHMS.md)** - Adaptive difficulty algorithm with pseudocode
- **[LEADERBOARD_STRATEGY.md](docs/LEADERBOARD_STRATEGY.md)** - Leaderboard update and ranking strategy
- **[STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md)** - State management and idempotency design
- **[CACHING_STRATEGY.md](docs/CACHING_STRATEGY.md)** - Redis caching strategy and patterns
- **[API_DESIGN.md](docs/API_DESIGN.md)** - Complete API specification with request/response schemas
- **[FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)** - Project folder structure for backend and frontend
- **[DOCKER_ARCHITECTURE.md](docs/DOCKER_ARCHITECTURE.md)** - Docker setup and container architecture
- **[DESIGN_SUMMARY.md](docs/DESIGN_SUMMARY.md)** - High-level design summary and overview
- **[CORRECTIONS.md](docs/CORRECTIONS.md)** - Critical design corrections and improvements
- **[ANSWER_SUBMISSION_FLOW.md](docs/ANSWER_SUBMISSION_FLOW.md)** - Final consolidated answer submission algorithm

## 🎯 System Overview

BrainBolt is an adaptive infinite quiz platform featuring:

- **Adaptive Difficulty**: Algorithm adjusts question difficulty based on user performance
- **Streak System**: Tracks consecutive correct answers with multipliers
- **Live Leaderboards**: Real-time score and streak rankings
- **Strong Consistency**: Per-user state consistency with optimistic locking
- **Idempotent Operations**: Prevents duplicate answer submissions
- **Redis Caching**: Fast access to user state and leaderboards
- **Stateless Backend**: Horizontally scalable architecture
- **Dockerized**: Single command deployment

## 🚀 Quick Start (After Implementation)

```bash
# Start entire stack
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📖 Getting Started

1. Review the design documents in `docs/`
2. Understand the architecture and algorithms
3. Set up development environment
4. Begin implementation following the design specifications

## 🔧 Tech Stack

- **Frontend**: Next.js 13+ (TypeScript), React, Tailwind CSS
- **Backend**: Node.js, Express/Fastify, TypeScript
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Containerization**: Docker, Docker Compose

## 📝 License

[Add your license here]
