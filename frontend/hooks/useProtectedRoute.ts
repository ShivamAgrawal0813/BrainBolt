/**
 * useProtectedRoute Hook
 * Ensures component is only rendered if authenticated
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export const useProtectedRoute = (redirectPath: string = '/login') => {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (!state.isAuthenticated) {
      router.push(redirectPath);
    }
  }, [state.isAuthenticated, router, redirectPath]);

  return state.isAuthenticated;
};
