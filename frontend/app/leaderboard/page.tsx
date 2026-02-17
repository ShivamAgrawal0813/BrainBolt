/**
 * Leaderboard Page
 * Displays top users by score and streak with premium design
 */

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import styles from './leaderboard.module.css';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboards | BrainBolt',
  description: 'See the top BrainBolt players by score and streak.',
};

export default function LeaderboardPage() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Leaderboards</h1>
        <p className={styles.subtitle}>See who&apos;s dominating the quiz</p>
      </div>

      <div className={styles.grid}>
        <Card className={styles.boardCard}>
          <div className={styles.boardHeader}>
            <span className={styles.boardIcon}>🏆</span>
            <h2 className={styles.boardTitle}>Top Scores</h2>
          </div>
          <LeaderboardTable type="score" />
        </Card>

        <Card className={styles.boardCard}>
          <div className={styles.boardHeader}>
            <span className={styles.boardIcon}>⚡</span>
            <h2 className={styles.boardTitle}>Best Streaks</h2>
          </div>
          <LeaderboardTable type="streak" />
        </Card>
      </div>
    </div>
  );
}
