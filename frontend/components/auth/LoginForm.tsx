/**
 * Login Form Component
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import styles from './AuthForm.module.css';

interface LoginFormProps {
  onSuccess?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password]);

  const mutation = useMutation({
    mutationFn: () => apiClient.login(email, password),
    onSuccess: (data) => {
      login(data.token, { userId: data.userId, username: data.username });
      onSuccess?.();
      router.push('/quiz');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Login failed. Please try again.';
      setApiError(message);
    },
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;
      setApiError('');
      mutation.mutate();
    },
    [validateForm, mutation]
  );

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {apiError && (
        <Alert type="error" message={apiError} onClose={() => setApiError('')} />
      )}

      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        placeholder="you@example.com"
        disabled={mutation.isPending}
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        placeholder="••••••••"
        disabled={mutation.isPending}
      />

      <Button
        type="submit"
        fullWidth
        isLoading={mutation.isPending}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Logging in...' : 'Log In'}
      </Button>
    </form>
  );
};
