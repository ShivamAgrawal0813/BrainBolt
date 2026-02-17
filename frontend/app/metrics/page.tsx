/**
 * Metrics Page
 * Shows user statistics and performance
 */

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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
      <h1 className={styles.title}>Your Performance Metrics</h1>

      {error && (
        <Alert type="error" message="Failed to load metrics. Please try again." />
      )}

      {isLoading ? (
        <div className={styles.gridLoading}>
          <Skeleton height="200px" />
          <Skeleton height="200px" />
          <Skeleton height="200px" />
        </div>
      ) : metrics ? (
        <>
          {/* Main Stats */}
          <div className={styles.stats}>
            <Card className={styles.statCard}>
              <h3 className={styles.statLabel}>Overall Accuracy</h3>
              <p className={styles.statValue}>{metrics.accuracy.toFixed(1)}%</p>
            </Card>
            <Card className={styles.statCard}>
              <h3 className={styles.statLabel}>Max Streak</h3>
              <p className={styles.statValue}>{metrics.maxStreak}</p>
            </Card>
            <Card className={styles.statCard}>
              <h3 className={styles.statLabel}>Total Score</h3>
              <p className={styles.statValue}>{metrics.totalScore}</p>
            </Card>
          </div>

          {/* Difficulty Histogram */}
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>Performance by Difficulty</h2>
            <div className={styles.histogram}>
              {metrics.difficultyHistogram.map((item) => (
                <div key={item.difficulty} className={styles.diffColumn}>
                  <div
                    className={styles.bar}
                    style={{
                      height: `${(item.accuracy / 100) * 150}px`,
                    }}
                  />
                  <p className={styles.label}>L{item.difficulty}</p>
                  <p className={styles.accuracy}>{item.accuracy.toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Performance */}
          <Card className={styles.section}>
            <h2 className={styles.sectionTitle}>Recent Performance</h2>
            <div className={styles.recentStats}>
              <div className={styles.stat}>
                <span className={styles.label}>Last 10 Answers</span>
                <span className={styles.value}>{metrics.recentPerformance.last10Answers.accuracy.toFixed(1)}% correct</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Trend</span>
                <span className={`${styles.value} ${styles[metrics.recentPerformance.last10Answers.trend]}`}>
                  {metrics.recentPerformance.last10Answers.trend.charAt(0).toUpperCase() +
                    metrics.recentPerformance.last10Answers.trend.slice(1)}
                </span>
              </div>
            </div>
          </Card>

          {/* Navigation */}
          <div className={styles.nav}>
            <Link href="/quiz" className={styles.navLink}>
              ← Back to Quiz
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
