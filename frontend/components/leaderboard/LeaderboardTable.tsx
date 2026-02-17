/**
 * Leaderboard Table Component
 * Client component that fetches leaderboard data using React Query
 * Features: Medals for top 3, username display, hover effects
 */

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import styles from './LeaderboardTable.module.css';

interface LeaderboardTableProps {
  type: 'score' | 'streak';
}

const MEDAL_MAP: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ type }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', type],
    queryFn: () =>
      type === 'score'
        ? apiClient.getLeaderboardScore(10)
        : apiClient.getLeaderboardStreak(10),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return <Skeleton height="300px" />;
  }

  if (error) {
    return <div className={styles.error}>Failed to load leaderboard</div>;
  }

  if (!data?.leaderboard || data.leaderboard.length === 0) {
    return <div className={styles.empty}>No entries yet. Be the first!</div>;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thRank}>#</th>
            <th>Player</th>
            <th className={styles.thValue}>{type === 'score' ? 'Score' : 'Streak'}</th>
          </tr>
        </thead>
        <tbody>
          {data.leaderboard.map((entry, index) => {
            const rank = entry.rank ?? index + 1;
            const medal = MEDAL_MAP[rank];
            const displayName = entry.username || entry.userId;

            return (
              <tr key={entry.userId} className={`${styles.row} ${rank <= 3 ? styles.topThree : ''}`}>
                <td className={styles.rankCell}>
                  {medal ? (
                    <span className={styles.medal}>{medal}</span>
                  ) : (
                    <span className={styles.rankNum}>{rank}</span>
                  )}
                </td>
                <td className={styles.nameCell}>{displayName}</td>
                <td className={styles.valueCell}>
                  {type === 'score' ? entry.totalScore?.toLocaleString() : entry.maxStreak}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
