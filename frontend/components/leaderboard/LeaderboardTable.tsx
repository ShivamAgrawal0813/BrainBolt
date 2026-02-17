/**
 * Leaderboard Table Component
 * Client component that fetches leaderboard data using React Query
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

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ type }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', type],
    queryFn: () =>
      type === 'score'
        ? apiClient.getLeaderboardScore(10)
        : apiClient.getLeaderboardStreak(10),
    refetchInterval: 30000, // auto-refresh every 30s for near-realtime
  });

  if (isLoading) {
    return <Skeleton height="300px" />;
  }

  if (error) {
    return <div className={styles.error}>Failed to load leaderboard</div>;
  }

  if (!data?.leaderboard || data.leaderboard.length === 0) {
    return <div className={styles.empty}>No entries yet</div>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Rank</th>
          <th>User</th>
          <th>{type === 'score' ? 'Score' : 'Streak'}</th>
        </tr>
      </thead>
      <tbody>
        {data.leaderboard.map((entry, index) => (
          <tr key={entry.userId} className={styles.row}>
            <td className={styles.rank}>{entry.rank ?? index + 1}</td>
            <td className={styles.username}>{entry.userId}</td>
            <td className={styles.value}>
              {type === 'score' ? entry.totalScore : entry.maxStreak}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
