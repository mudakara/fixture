'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';

function PlayerPointsContent() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Player Points Scorecard</h1>
            <p className="text-gray-600 mt-1">Track individual player rankings and points</p>
          </div>

          {/* Coming Soon */}
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <svg className="mx-auto h-24 w-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Player Points Coming Soon</h3>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">
              Individual player points tracking will be available in the next update. 
              This feature will show player rankings across all activities and teams.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayerPointsPage() {
  return (
    <AuthGuard>
      <PlayerPointsContent />
    </AuthGuard>
  );
}