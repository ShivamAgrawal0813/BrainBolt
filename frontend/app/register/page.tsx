/**
 * Register Page
 */

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { RegisterForm } from '@/components/auth/RegisterForm';
import styles from '../auth.module.css';

export default function RegisterPage() {
  return (
    <div className={styles.authContainer}>
      <Card className={styles.authCard}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>Join BrainBolt and start learning</p>

        <RegisterForm />

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link href="/login" className={styles.link}>
            Log in instead
          </Link>
        </p>
      </Card>
    </div>
  );
}
