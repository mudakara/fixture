'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { useMsal } from '@azure/msal-react';

function DashboardContent() {
  const { user, signOut } = useAuth();
  const { instance } = useMsal();

  if (!user) {
    return <div>Loading...</div>;
  }

  const handleLogout = async () => {
    try {
      // Clear MSAL session
      if (instance.getAllAccounts().length > 0) {
        await instance.logoutPopup();
      }
      // Clear local session
      signOut();
    } catch (error) {
      console.error('Logout error:', error);
      // Even if MSAL logout fails, clear local session
      signOut();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900">Welcome to MatchMaker Pro</h1>
              <div className="mt-4">
                <p className="text-gray-600">Hello, {user.displayName || user.name}!</p>
                <p className="text-sm text-gray-500 mt-1">Email: {user.email}</p>
                <p className="text-sm text-gray-500">Role: {user.role}</p>
                {user.department && (
                  <p className="text-sm text-gray-500">Department: {user.department}</p>
                )}
                {user.jobTitle && (
                  <p className="text-sm text-gray-500">Job Title: {user.jobTitle}</p>
                )}
              </div>
              <div className="mt-6">
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}