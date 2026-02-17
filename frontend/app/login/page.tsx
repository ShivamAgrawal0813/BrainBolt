/**
 * Login Page
 */

import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';
import styles from '../auth.module.css';

export default function LoginPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <span className={styles.authIcon}>🔐</span>
          <h1 className={styles.authTitle}>Welcome Back</h1>
          <p className={styles.authSubtitle}>Sign in to continue your quiz journey</p>
        </div>

        <LoginForm />

        <p className={styles.authFooter}>
          Don&apos;t have an account?{' '}
          <Link href="/register">Create one free</Link>
        </p>
      </div>
    </div>
  );
}
