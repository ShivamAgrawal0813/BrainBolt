/**
 * 404 Not Found Page
 */

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import styles from './error.module.css';

export default function NotFound() {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <span className={styles.icon}>🔍</span>
                <h1 className={styles.title}>Page Not Found</h1>
                <p className={styles.description}>
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link href="/">
                    <Button>Go Home</Button>
                </Link>
            </div>
        </div>
    );
}
