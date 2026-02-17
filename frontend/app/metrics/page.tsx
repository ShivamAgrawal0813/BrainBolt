/**
 * Metrics Page — Premium design with animated charts and stat cards
 */

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import styles from './metrics.module.css';

export default function MetricsPage() {
  const isAuthenticated = useProtectedRoute();

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => apiClient.getMetrics(),
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) {
    return <div className={styles.loading}>Redirecting to login...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your Performance</h1>
        <p className={styles.subtitle}>Track your progress and improve</p>
      </div>

      {error && (
        <Alert type="error" message="Failed to load metrics. Please try again." />
      )}

      {isLoading ? (
        <div className={styles.statsGrid}>
          <Skeleton height="140px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
        </div>
      ) : metrics ? (
        <>
          {/* Stat Cards */}
          <div className={styles.statsGrid}>
            <Card className={styles.statCard}>
              <div className={styles.statIcon}>🎯</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Accuracy</span>
                <span className={styles.statValue}>{metrics.accuracy.toFixed(1)}%</span>
              </div>
            </Card>

            <Card className={styles.statCard}>
              <div className={styles.statIcon}>🏆</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Total Score</span>
                <span className={styles.statValue}>{metrics.totalScore.toLocaleString()}</span>
              </div>
            </Card>

            <Card className={styles.statCard}>
              <div className={styles.statIcon}>🔥</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Max Streak</span>
                <span className={styles.statValue}>{metrics.maxStreak}</span>
              </div>
            </Card>

            <Card className={styles.statCard}>
              <div className={styles.statIcon}>📊</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Current Level</span>
                <span className={styles.statValue}>{metrics.currentDifficulty}</span>
              </div>
            </Card>
          </div>

          {/* Difficulty Histogram */}
          <Card className={styles.chartCard}>
            <h2 className={styles.sectionTitle}>Performance by Difficulty</h2>
            <div className={styles.histogram}>
              {metrics.difficultyHistogram.map((item) => (
                <div key={item.difficulty} className={styles.barGroup}>
                  <div className={styles.barContainer}>
                    <div
                      className={styles.bar}
                      style={{
                        height: `${Math.max(item.accuracy, 4)}%`,
                      }}
                    >
                      <span className={styles.barLabel}>{item.accuracy.toFixed(0)}%</span>
                    </div>
                  </div>
                  <span className={styles.barLevel}>L{item.difficulty}</span>
                  <span className={styles.barCount}>{item.answered} Q</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Performance */}
          <Card className={styles.chartCard}>
            <h2 className={styles.sectionTitle}>Recent Performance</h2>
            <div className={styles.recentGrid}>
              <div className={styles.recentStat}>
                <span className={styles.recentLabel}>Last 10 Answers</span>
                <span className={styles.recentValue}>
                  {metrics.recentPerformance.last10Answers.accuracy.toFixed(1)}% correct
                </span>
              </div>
              <div className={styles.recentStat}>
                <span className={styles.recentLabel}>Trend</span>
                <span className={`${styles.recentValue} ${styles[metrics.recentPerformance.last10Answers.trend]}`}>
                  {metrics.recentPerformance.last10Answers.trend === 'improving' ? '📈' :
                    metrics.recentPerformance.last10Answers.trend === 'declining' ? '📉' : '➡️'}
                  {' '}
                  {metrics.recentPerformance.last10Answers.trend.charAt(0).toUpperCase() +
                    metrics.recentPerformance.last10Answers.trend.slice(1)}
                </span>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
