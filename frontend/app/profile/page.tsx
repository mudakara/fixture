'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import { useState } from 'react';

function ProfileContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Profile Header */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center">
                <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-bold text-3xl">
                    {user.displayName?.charAt(0).toUpperCase() || user.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="ml-6">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {user.displayName || user.name}
                  </h1>
                  <p className="text-gray-600">{user.email}</p>
                  <div className="mt-2 flex items-center space-x-4">
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                      {user.role}
                    </span>
                    {user.authProvider === 'azuread' && (
                      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        Microsoft Account
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white shadow rounded-lg">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'overview'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('team')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'team'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Team Info
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'activity'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Activity Log
                </button>
              </nav>
            </div>

            {/* Tab Content */}
            <div className="px-4 py-5 sm:p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {user.displayName || user.name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Email Address</dt>
                        <dd className="mt-1 text-sm text-gray-900">{user.email}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Role</dt>
                        <dd className="mt-1 text-sm text-gray-900 capitalize">{user.role}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Authentication Type</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {user.authProvider === 'azuread' ? 'Microsoft Azure AD' : 'Local Account'}
                        </dd>
                      </div>
                      {user.department && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Department</dt>
                          <dd className="mt-1 text-sm text-gray-900">{user.department}</dd>
                        </div>
                      )}
                      {user.jobTitle && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Job Title</dt>
                          <dd className="mt-1 text-sm text-gray-900">{user.jobTitle}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Account Details</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Account Created</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}
                        </dd>
                      </div>
                      {user.azureAdId && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Azure AD ID</dt>
                          <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">
                            {user.azureAdId}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              )}

              {activeTab === 'team' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Team Information</h3>
                  {user.team ? (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Team Name</dt>
                        <dd className="mt-1 text-sm text-gray-900">{user.team.name}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Position</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {user.role === 'captain' ? 'Team Captain' : 'Player'}
                        </dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-gray-500">You are not currently assigned to any team.</p>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-4">
                    <p className="text-gray-500">No activity logged yet.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}