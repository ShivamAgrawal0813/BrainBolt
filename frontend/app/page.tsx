/**
 * Home Page — Premium Landing
 */

'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

export default function Home() {
  const { state } = useAuth();
  const { isAuthenticated } = state;

  return (
    <div className={styles.hero}>
      {/* Gradient orbs background */}
      <div className={styles.orbContainer} aria-hidden="true">
        <div className={styles.orb1} />
        <div className={styles.orb2} />
        <div className={styles.orb3} />
      </div>

      <div className={styles.heroContent}>
        <div className={styles.badge}>⚡ Adaptive Infinite Quiz</div>
        <h1 className={styles.title}>
          Train Your Brain.<br />
          <span className={styles.titleAccent}>Beat the Algorithm.</span>
        </h1>
        <p className={styles.description}>
          BrainBolt adapts in real-time to your skill level. Build streaks, climb leaderboards,
          and push your limits with an AI-powered difficulty engine.
        </p>

        <div className={styles.actions}>
          <Link
            href={isAuthenticated ? "/quiz" : "/register"}
            className={styles.ctaPrimary}
            id="cta-primary"
          >
            {isAuthenticated ? 'Continue Playing →' : 'Start Playing →'}
          </Link>

          {!isAuthenticated && (
            <Link href="/login" className={styles.ctaSecondary} id="cta-login">
              I have an account
            </Link>
          )}
        </div>
      </div>

      {/* Feature cards */}
      <div className={styles.features}>
        <div className={styles.featureCard} style={{ animationDelay: '0.1s' }}>
          <div className={styles.featureIcon}>🧠</div>
          <h3 className={styles.featureTitle}>Adaptive Difficulty</h3>
          <p className={styles.featureDesc}>
            Questions dynamically adjust based on your performance, confidence, and streaks.
          </p>
        </div>

        <div className={styles.featureCard} style={{ animationDelay: '0.2s' }}>
          <div className={styles.featureIcon}>⚡</div>
          <h3 className={styles.featureTitle}>Real-Time Scoring</h3>
          <p className={styles.featureDesc}>
            Instant feedback with streak multipliers, difficulty bonuses, and accuracy rewards.
          </p>
        </div>

        <div className={styles.featureCard} style={{ animationDelay: '0.3s' }}>
          <div className={styles.featureIcon}>🏆</div>
          <h3 className={styles.featureTitle}>Live Leaderboards</h3>
          <p className={styles.featureDesc}>
            Compete globally with live rankings by total score and current streak.
          </p>
        </div>
      </div>
    </div>
  );
}
