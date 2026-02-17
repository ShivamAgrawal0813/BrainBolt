/**
 * Home Page
 */

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.hero}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Welcome to BrainBolt</h1>
        <p className={styles.description}>
          An adaptive infinite quiz platform that challenges your knowledge and adjusts difficulty in real-time.
        </p>

        <div className={styles.features}>
          <div className={styles.feature}>
            <span className={styles.icon}>🧠</span>
            <h3>Adaptive Difficulty</h3>
            <p>Questions adjust to your skill level</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.icon}>⚡</span>
            <h3>Real-Time Feedback</h3>
            <p>Instant scoring and streak tracking</p>
          </div>
          <div className={styles.feature}>
            <span className={styles.icon}>🏆</span>
            <h3>Leaderboards</h3>
            <p>Compete with other players worldwide</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/login">
            <Button fullWidth>Log In</Button>
          </Link>
          <Link href="/register">
            <Button variant="secondary" fullWidth>Create Account</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
