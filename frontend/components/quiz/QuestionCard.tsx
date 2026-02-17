/**
 * Question Card Component
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
    return (
      <Card className={styles.card}>
        {!isLoading && (
          <div className={styles.difficulty}>
            <span className={styles.badge}>Level {difficulty}</span>
          </div>
        )}
        <h2 className={styles.prompt}>{prompt}</h2>
      </Card>
    );
  }
);

QuestionCard.displayName = 'QuestionCard';
