/**
 * Register Page
 */

import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';
import styles from '../auth.module.css';

export default function RegisterPage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.authCard}>
        <div className={styles.authHeader}>
          <span className={styles.authIcon}>⚡</span>
          <h1 className={styles.authTitle}>Join BrainBolt</h1>
          <p className={styles.authSubtitle}>Create your account and start competing</p>
        </div>

        <RegisterForm />

        <p className={styles.authFooter}>
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
