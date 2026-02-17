/**
 * Button Component
 * Reusable, unstyled button with semantic HTML and token-based styling
 */

import React from 'react';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const className = [
      styles.button,
      styles[variant],
      styles[size],
      isLoading && styles.loading,
      fullWidth && styles.fullWidth,
      disabled && styles.disabled,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={className}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? <span className={styles.spinner}></span> : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
