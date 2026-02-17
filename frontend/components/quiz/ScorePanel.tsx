/**
 * Score Panel Component
 */

import React from 'react';
import styles from './ScorePanel.module.css';

interface ScorePanelProps {
  currentScore: number;
  currentStreak: number;
  currentDifficulty: number;
}

export const ScorePanel = React.memo<ScorePanelProps>(
  ({ currentScore, currentStreak, currentDifficulty }) => {
    return (
      <div className={styles.panel}>
        <div className={styles.stat}>
          <span className={styles.label}>Score</span>
          <span className={styles.value}>{currentScore}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Streak</span>
          <span className={styles.value}>{currentStreak}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>Difficulty</span>
          <span className={styles.value}>{currentDifficulty}/10</span>
        </div>
      </div>
    );
  }
);

ScorePanel.displayName = 'ScorePanel';
