'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store/store';
import { loginSuccess, logout } from '@/store/slices/authSlice';
import { useMsal } from '@azure/msal-react';

export const useAuth = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { accounts } = useMsal();

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem('user');
    
    if (storedUser && !isAuthenticated) {
      try {
        const userData = JSON.parse(storedUser);
        dispatch(loginSuccess(userData));
      } catch (error) {
        console.error('Failed to parse stored user data:', error);
        localStorage.removeItem('user');
      }
    }
  }, [dispatch, isAuthenticated]);

  const checkAuth = () => {
    // Check both Redux state and localStorage
    const storedUser = localStorage.getItem('user');
    return isAuthenticated || !!storedUser || accounts.length > 0;
  };

  const requireAuth = () => {
    if (!checkAuth()) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const signOut = () => {
    localStorage.removeItem('user');
    dispatch(logout());
    router.push('/login');
  };

  return {
    user,
    isAuthenticated: checkAuth(),
    requireAuth,
    signOut,
    isLoading: false
  };
};