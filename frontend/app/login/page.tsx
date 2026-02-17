/**
 * Login Page
 */

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { LoginForm } from '@/components/auth/LoginForm';
import styles from '../auth.module.css';

export default function LoginPage() {
  return (
    <div className={styles.authContainer}>
      <Card className={styles.authCard}>
        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.subtitle}>Enter your credentials to access BrainBolt</p>

        <LoginForm />

        <p className={styles.footer}>
          Don&apos;t have an account?{' '}
          <Link href="/register" className={styles.link}>
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}
