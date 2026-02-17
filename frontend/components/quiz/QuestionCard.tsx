/**
 * Question Card Component — with difficulty progress bar
 */

import React from 'react';
import { Card } from '@/components/ui/Card';
import styles from './QuestionCard.module.css';

interface QuestionCardProps {
  difficulty: number;
  prompt: string;
  isLoading?: boolean;
}

export const QuestionCard = React.memo<QuestionCardProps>(
  ({ difficulty, prompt, isLoading = false }) => {
    const fillPercent = (difficulty / 10) * 100;

    return (
      <Card className={styles.card}>
        {!isLoading && (
          <div className={styles.difficulty}>
            <span className={styles.badge}>Level {difficulty}</span>
            <div className={styles.difficultyBar}>
              <div
                className={styles.difficultyFill}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>
        )}
        <h2 className={styles.prompt}>{prompt}</h2>
      </Card>
    );
  }
);

QuestionCard.displayName = 'QuestionCard';
