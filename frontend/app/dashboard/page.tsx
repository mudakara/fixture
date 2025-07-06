'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';

function DashboardContent() {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Statistics Cards */}
                <div className="bg-indigo-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-indigo-900">Total Teams</h3>
                  <p className="text-3xl font-bold text-indigo-600 mt-2">0</p>
                </div>
                <div className="bg-green-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-green-900">Active Fixtures</h3>
                  <p className="text-3xl font-bold text-green-600 mt-2">0</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-lg font-medium text-blue-900">Total Players</h3>
                  <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-500 text-center">No recent activity</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {user.role === 'super_admin' || user.role === 'admin' ? (
                    <>
                      <button className="bg-white border border-gray-300 rounded-lg p-4 hover:bg-gray-50 text-left">
                        <h3 className="font-medium text-gray-900">Create Team</h3>
                        <p className="text-sm text-gray-500 mt-1">Add a new team to the system</p>
                      </button>
                      <button className="bg-white border border-gray-300 rounded-lg p-4 hover:bg-gray-50 text-left">
                        <h3 className="font-medium text-gray-900">Schedule Fixture</h3>
                        <p className="text-sm text-gray-500 mt-1">Create a new match fixture</p>
                      </button>
                      <button className="bg-white border border-gray-300 rounded-lg p-4 hover:bg-gray-50 text-left">
                        <h3 className="font-medium text-gray-900">Add Player</h3>
                        <p className="text-sm text-gray-500 mt-1">Register a new player</p>
                      </button>
                    </>
                  ) : (
                    <button className="bg-white border border-gray-300 rounded-lg p-4 hover:bg-gray-50 text-left">
                      <h3 className="font-medium text-gray-900">View My Team</h3>
                      <p className="text-sm text-gray-500 mt-1">See your team details</p>
                    </button>
                  )}
                </div>
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