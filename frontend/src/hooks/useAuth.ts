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
    if (typeof window !== 'undefined') {
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
    }
  }, [dispatch, isAuthenticated]);

  const checkAuth = () => {
    // Check both Redux state and localStorage
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('user');
      return isAuthenticated || !!storedUser || accounts.length > 0;
    }
    return isAuthenticated || accounts.length > 0;
  };

  const requireAuth = () => {
    if (!checkAuth()) {
      router.push('/login');
      return false;
    }
    return true;
  };

  const signOut = async () => {
    // Clear local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user');
    }
    
    // Clear Redux state
    dispatch(logout());
    
    // Try to logout from MSAL
    if (typeof window !== 'undefined') {
      const { instance } = await import('@azure/msal-react').then(m => ({ instance: (window as any).msalInstance }));
      if (instance && instance.getAllAccounts().length > 0) {
        try {
          await instance.logoutPopup();
        } catch (error) {
          console.error('MSAL logout error:', error);
        }
      }
    }
    
    // Redirect to login
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