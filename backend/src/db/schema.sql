-- BrainBolt Database Schema
-- PostgreSQL 15+
-- Auto-run on first startup via /docker-entrypoint-initdb.d/

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT username_length CHECK (char_length(username) >= 3 AND char_length(username) <= 50),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_last_active ON users(last_active_at DESC);

-- ============================================================================
-- QUESTIONS TABLE
-- ============================================================================
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    difficulty_level INTEGER NOT NULL CHECK (difficulty_level >= 1 AND difficulty_level <= 10),
    category VARCHAR(100),
    tags TEXT[],
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT question_text_length CHECK (char_length(question_text) >= 10 AND char_length(question_text) <= 2000)
);

CREATE INDEX idx_questions_difficulty ON questions(difficulty_level) WHERE is_active = TRUE;
CREATE INDEX idx_questions_category ON questions(category) WHERE is_active = TRUE;
CREATE INDEX idx_questions_tags ON questions USING GIN(tags) WHERE is_active = TRUE;
CREATE INDEX idx_questions_active ON questions(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- USER_STATE TABLE
-- ============================================================================
CREATE TABLE user_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_difficulty INTEGER NOT NULL DEFAULT 5 CHECK (current_difficulty >= 1 AND current_difficulty <= 10),
    total_score BIGINT NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    current_streak INTEGER NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    max_streak INTEGER NOT NULL DEFAULT 0 CHECK (max_streak >= 0),
    questions_answered INTEGER NOT NULL DEFAULT 0 CHECK (questions_answered >= 0),
    correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
    state_version INTEGER NOT NULL DEFAULT 1,
    last_question_id UUID REFERENCES questions(id),
    last_answered_at TIMESTAMP WITH TIME ZONE,
    confidence_score DECIMAL(5,2) DEFAULT 0.50 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    performance_window JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_state UNIQUE(user_id),
    CONSTRAINT correct_answers_limit CHECK (correct_answers <= questions_answered)
);

CREATE INDEX idx_user_state_user_id ON user_state(user_id);
CREATE INDEX idx_user_state_score ON user_state(total_score DESC);
CREATE INDEX idx_user_state_streak ON user_state(max_streak DESC);
CREATE INDEX idx_user_state_last_answered ON user_state(last_answered_at DESC);

-- ============================================================================
-- ANSWER_LOG TABLE
-- ============================================================================
CREATE TABLE answer_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE RESTRICT,
    user_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    difficulty_level INTEGER NOT NULL CHECK (difficulty_level >= 1 AND difficulty_level <= 10),
    score_delta INTEGER NOT NULL,
    streak_at_answer INTEGER NOT NULL DEFAULT 0 CHECK (streak_at_answer >= 0),
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    request_hash VARCHAR(128) NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT answer_length CHECK (char_length(user_answer) <= 1000)
);

CREATE INDEX idx_answer_log_user_id ON answer_log(user_id);
CREATE INDEX idx_answer_log_question_id ON answer_log(question_id);
CREATE INDEX idx_answer_log_user_answered_at ON answer_log(user_id, answered_at DESC);
CREATE INDEX idx_answer_log_idempotency ON answer_log(idempotency_key);
CREATE INDEX idx_answer_log_request_hash ON answer_log(request_hash);
CREATE INDEX idx_answer_log_correct ON answer_log(user_id, is_correct, answered_at DESC);

-- ============================================================================
-- LEADERBOARD_SCORE TABLE (application-layer updates only)
-- ============================================================================
CREATE TABLE leaderboard_score (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_score BIGINT NOT NULL DEFAULT 0 CHECK (total_score >= 0),
    rank INTEGER,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_score UNIQUE(user_id)
);

CREATE INDEX idx_leaderboard_score_score ON leaderboard_score(total_score DESC);
CREATE INDEX idx_leaderboard_score_user_id ON leaderboard_score(user_id);
CREATE INDEX idx_leaderboard_score_rank ON leaderboard_score(rank) WHERE rank IS NOT NULL;

-- ============================================================================
-- LEADERBOARD_STREAK TABLE (application-layer updates only)
-- ============================================================================
CREATE TABLE leaderboard_streak (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_streak INTEGER NOT NULL DEFAULT 0 CHECK (max_streak >= 0),
    rank INTEGER,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_streak UNIQUE(user_id)
);

CREATE INDEX idx_leaderboard_streak_streak ON leaderboard_streak(max_streak DESC);
CREATE INDEX idx_leaderboard_streak_user_id ON leaderboard_streak(user_id);
CREATE INDEX idx_leaderboard_streak_rank ON leaderboard_streak(rank) WHERE rank IS NOT NULL;

-- ============================================================================
-- TRIGGERS (updated_at only)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_state_updated_at BEFORE UPDATE ON user_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEW
-- ============================================================================
CREATE OR REPLACE VIEW user_statistics AS
SELECT
    u.id,
    u.username,
    us.total_score,
    us.current_streak,
    us.max_streak,
    us.questions_answered,
    us.correct_answers,
    CASE WHEN us.questions_answered > 0
        THEN ROUND((us.correct_answers::DECIMAL / us.questions_answered) * 100, 2)
        ELSE 0 END AS accuracy_percentage,
    us.current_difficulty,
    us.last_answered_at,
    ls.rank AS score_rank,
    lst.rank AS streak_rank
FROM users u
LEFT JOIN user_state us ON u.id = us.user_id
LEFT JOIN leaderboard_score ls ON u.id = ls.user_id
LEFT JOIN leaderboard_streak lst ON u.id = lst.user_id;
