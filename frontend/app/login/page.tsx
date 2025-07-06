'use client';

import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/config/authConfig';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '@/store/slices/authSlice';
import axios from 'axios';

export default function LoginPage() {
  const { instance, accounts } = useMsal();
  const router = useRouter();
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      router.push('/dashboard');
      return;
    }

    if (accounts.length > 0) {
      handleAuthentication();
    }
  }, [accounts, router]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    dispatch(loginStart());
    
    try {
      const response = await instance.loginPopup(loginRequest);
      if (response) {
        await handleAuthentication();
      }
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = 'Failed to sign in with Microsoft. Please try again.';
      setError(errorMessage);
      dispatch(loginFailure(errorMessage));
      setIsLoading(false);
    }
  };

  const handleAuthentication = async () => {
    if (accounts.length === 0) return;
    
    try {
      console.log('Accounts:', accounts);
      console.log('Login request scopes:', loginRequest.scopes);
      
      let tokenResponse;
      try {
        // Try silent token acquisition first
        tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });
      } catch (silentError) {
        console.log('Silent token acquisition failed, trying interactive');
        // If silent fails, try interactive
        tokenResponse = await instance.acquireTokenPopup({
          ...loginRequest,
          account: accounts[0],
        });
      }
      
      console.log('Token acquired successfully');

      // Send token to backend for validation and user creation/update
      console.log('Sending request to:', `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft`);
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/microsoft`,
        {
          token: tokenResponse.accessToken,
        },
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        // Store user data in Redux
        dispatch(loginSuccess(response.data.user));
        localStorage.setItem('user', JSON.stringify(response.data.user));
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error('Authentication failed:', error);
      let errorMessage = 'Failed to authenticate. Please try again.';
      
      if (error.response) {
        // Server responded with error
        errorMessage = error.response.data?.error || errorMessage;
        console.error('Server error:', error.response.data);
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'Cannot connect to server. Please check if the backend is running.';
        console.error('No response from server:', error.request);
      } else {
        // Something else happened
        console.error('Error setting up request:', error.message);
      }
      
      setError(errorMessage);
      dispatch(loginFailure(errorMessage));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            MatchMaker Pro
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sports Fixture Management System
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="space-y-6">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                    {error}
                  </div>
                )}
                
                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                        <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                        <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                        <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                      </svg>
                      Sign in with Microsoft
                    </>
                  )}
                </button>
                
                <div className="text-center text-sm text-gray-600">
                  <p>Use your organizational Microsoft account to sign in</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}