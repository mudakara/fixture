'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';

function PlayersContent() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900">Players</h1>
              <p className="mt-2 text-gray-600">Manage players in the system</p>
              <div className="mt-6">
                <p className="text-gray-500">Players functionality coming soon...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayersPage() {
  return (
    <AuthGuard>
      <PlayersContent />
    </AuthGuard>
  );
}