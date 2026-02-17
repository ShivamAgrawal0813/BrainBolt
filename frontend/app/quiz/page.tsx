/**
 * Quiz Page
 * Core gameplay: fetches questions, submits answers, shows feedback
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { AnswerOptions } from '@/components/quiz/AnswerOptions';
import { ScorePanel } from '@/components/quiz/ScorePanel';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import type { AnswerResponse } from '@/types/api';
import styles from './quiz.module.css';

export default function QuizPage() {
  const isAuthenticated = useProtectedRoute();
  const queryClient = useQueryClient();

  const [userAnswer, setUserAnswer] = useState('');
  const [lastResult, setLastResult] = useState<AnswerResponse | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch next question
  const {
    data: question,
    isLoading: questionLoading,
    refetch: fetchNextQuestion,
  } = useQuery({
    queryKey: ['quiz', 'next'],
    queryFn: () => apiClient.getNextQuestion(),
    enabled: isAuthenticated,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: Infinity, // never auto-refetch — each GET /next changes last_question_id in DB
    retry: 1,
  });

  // Submit answer mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!question) throw new Error('No question loaded');
      const idempotencyKey = uuidv4();
      return apiClient.submitAnswer(
        question.questionId,
        userAnswer,
        question.stateVersion,
        idempotencyKey
      );
    },
    onSuccess: (data) => {
      setLastResult(data);
      setIsSubmitted(true);
      setError(null);
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error || 'Failed to submit answer. Please try again.';
      setError(message);
    },
  });

  // Handle answer submission
  const handleSubmit = useCallback(() => {
    if (!userAnswer.trim() || !question) return;
    setError(null);
    submitMutation.mutate();
  }, [userAnswer, question, submitMutation]);

  // Move to next question — only call refetch, NOT invalidateQueries + refetch
  // Each GET /next sets a random question as last_question_id in DB; calling it twice
  // would overwrite the first question's ID, causing a mismatch on submit.
  const handleNextQuestion = useCallback(() => {
    setUserAnswer('');
    setLastResult(null);
    setIsSubmitted(false);
    setError(null);
    fetchNextQuestion();
  }, [fetchNextQuestion]);

  if (!isAuthenticated) {
    return <div className={styles.loading}>Redirecting to login...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Score Panel */}
        {question && (
          <ScorePanel
            currentScore={lastResult ? lastResult.totalScore : question.currentScore}
            currentStreak={lastResult ? lastResult.newStreak : question.currentStreak}
            currentDifficulty={lastResult ? lastResult.newDifficulty : question.difficulty}
          />
        )}

        {/* Error Alert */}
        {error && (
          <Alert type="error" message={error} onClose={() => setError(null)} />
        )}

        {/* Question Card */}
        {questionLoading ? (
          <Skeleton height="200px" />
        ) : question ? (
          <>
            <QuestionCard
              difficulty={question.difficulty}
              prompt={question.prompt}
              isLoading={submitMutation.isPending}
            />

            {/* Answer Input */}
            <AnswerOptions
              selectedAnswer={userAnswer}
              onSelect={setUserAnswer}
              isLoading={submitMutation.isPending}
              isSubmitted={isSubmitted}
            />

            {/* Answer Feedback */}
            {lastResult && (
              <div
                className={styles.feedback}
                data-correct={lastResult.correct}
              >
                <div className={styles.feedbackHeader}>
                  {lastResult.correct ? '✅ Correct!' : '❌ Incorrect'}
                </div>
                <div className={styles.feedbackDetails}>
                  <span>Score: {lastResult.scoreDelta >= 0 ? '+' : ''}{lastResult.scoreDelta}</span>
                  <span>Streak: {lastResult.newStreak}</span>
                  <span>Rank: #{lastResult.leaderboardRankScore}</span>
                </div>
              </div>
            )}

            {/* Action Button */}
            {!isSubmitted ? (
              <Button
                onClick={handleSubmit}
                disabled={!userAnswer.trim() || submitMutation.isPending}
                isLoading={submitMutation.isPending}
                fullWidth
              >
                Submit Answer
              </Button>
            ) : (
              <Button onClick={handleNextQuestion} fullWidth>
                Next Question →
              </Button>
            )}
          </>
        ) : (
          <Alert type="error" message="Failed to load question. Please try again." />
        )}

        {/* Navigation */}
        <div className={styles.nav}>
          <Link href="/leaderboard" className={styles.navLink}>
            📊 Leaderboard
          </Link>
          <Link href="/metrics" className={styles.navLink}>
            📈 My Metrics
          </Link>
        </div>
      </div>
    </div>
  );
}
