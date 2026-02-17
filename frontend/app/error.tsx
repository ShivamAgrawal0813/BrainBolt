/**
 * Error Boundary Page
 */

'use client';

import { Button } from '@/components/ui/Button';
import styles from './error.module.css';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <span className={styles.icon}>⚠️</span>
                <h1 className={styles.title}>Something went wrong</h1>
                <p className={styles.description}>
                    An unexpected error occurred. Please try again.
                </p>
                <Button onClick={reset}>Try Again</Button>
            </div>
        </div>
    );
}
