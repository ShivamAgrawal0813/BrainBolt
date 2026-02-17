/**
 * Leaderboard Page - SSR
 * Displays top users by score and streak
 * This is the SSR page required by the spec; LeaderboardTable is a client component
 * that fetches data with React Query for interactivity.
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
      <h1 className={styles.title}>Leaderboards</h1>

      <div className={styles.grid}>
        {/* Score Leaderboard */}
        <Card>
          <h2 className={styles.sectionTitle}>🏆 Top Scores</h2>
          <LeaderboardTable type="score" />
        </Card>

        {/* Streak Leaderboard */}
        <Card>
          <h2 className={styles.sectionTitle}>⚡ Best Streaks</h2>
          <LeaderboardTable type="streak" />
        </Card>
      </div>

      <div className={styles.footer}>
        <Link href="/quiz" className={styles.backLink}>
          ← Back to Quiz
        </Link>
      </div>
    </div>
  );
}
