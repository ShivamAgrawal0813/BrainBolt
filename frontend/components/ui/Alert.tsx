/**
 * Alert Component
 */

import React from 'react';
import styles from './Alert.module.css';

interface AlertProps {
  type: 'error' | 'success' | 'info' | 'warning';
  message: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  return (
    <div className={`${styles.alert} ${styles[type]}`} role="alert">
      <p>{message}</p>
      {onClose && (
        <button onClick={onClose} className={styles.closeButton} aria-label="Close alert">
          ×
        </button>
      )}
    </div>
  );
};
