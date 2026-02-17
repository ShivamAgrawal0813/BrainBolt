/**
 * Answer Options Component
 */

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './AnswerOptions.module.css';

interface AnswerOptionsProps {
  selectedAnswer: string | null;
  onSelect: (answer: string) => void;
  isLoading?: boolean;
  isSubmitted?: boolean;
}

export const AnswerOptions = React.memo<AnswerOptionsProps>(
  ({ selectedAnswer, onSelect, isLoading = false, isSubmitted = false }) => {
    const handleClick = useCallback(
      (value: string) => {
        if (!isLoading && !isSubmitted) {
          onSelect(value);
        }
      },
      [isLoading, isSubmitted, onSelect]
    );

    // Placeholder single text input for now (can be extended for multiple choice)
    return (
      <div className={styles.container}>
        <input
          type="text"
          className={styles.answerInput}
          placeholder="Type your answer..."
          value={selectedAnswer || ''}
          onChange={(e) => handleClick(e.target.value)}
          disabled={isLoading || isSubmitted}
        />
      </div>
    );
  }
);

AnswerOptions.displayName = 'AnswerOptions';
