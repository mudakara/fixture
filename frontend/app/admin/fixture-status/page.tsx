'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface Fixture {
  _id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  participantType: 'player' | 'team';
  format: 'knockout' | 'roundrobin';
  eventId: {
    _id: string;
    name: string;
  };
  sportGameId: {
    _id: string;
    title: string;
  };
}

function FixtureStatusContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Check permissions
  const canManage = user?.role === 'super_admin' || user?.role === 'admin';
  
  useEffect(() => {
    if (!canManage) {
      router.push('/dashboard');
      return;
    }
    fetchFixtures();
  }, [canManage, router]);

  const fetchFixtures = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures`,
        { withCredentials: true }
      );
      setFixtures(response.data.fixtures);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching fixtures:', err);
      setLoading(false);
    }
  };

  const syncFixtureStatus = async (fixtureId: string) => {
    try {
      setSyncing(fixtureId);
      setMessage(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixtureId}/sync-status`,
        {},
        { withCredentials: true }
      );
      
      setMessage({
        type: 'success',
        text: response.data.message
      });
      
      // Refresh fixtures
      await fetchFixtures();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to sync fixture status'
      });
    } finally {
      setSyncing(null);
    }
  };

  const syncAllFixtures = async () => {
    setMessage(null);
    let successCount = 0;
    let errorCount = 0;
    
    for (const fixture of fixtures) {
      if (fixture.status !== 'completed') {
        try {
          setSyncing(fixture._id);
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture._id}/sync-status`,
            {},
            { withCredentials: true }
          );
          successCount++;
        } catch (err) {
          errorCount++;
        }
      }
    }
    
    setSyncing(null);
    
    if (successCount > 0 || errorCount > 0) {
      setMessage({
        type: errorCount === 0 ? 'success' : 'error',
        text: `Synced ${successCount} fixtures${errorCount > 0 ? `, ${errorCount} errors` : ''}`
      });
      await fetchFixtures();
    } else {
      setMessage({
        type: 'success',
        text: 'All fixtures are already up to date'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading fixtures...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fixture Status Management</h1>
              <p className="text-gray-600 mt-1">Sync fixture statuses based on match completion</p>
            </div>
            <button
              onClick={syncAllFixtures}
              disabled={syncing !== null}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing !== null ? 'Syncing...' : 'Sync All Fixtures'}
            </button>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {/* Fixtures Table */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fixture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fixtures.map((fixture) => (
                  <tr key={fixture._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {fixture.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {fixture.eventId?.name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {fixture.sportGameId?.title || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {fixture.participantType} / {fixture.format}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(fixture.status)}`}>
                        {fixture.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => syncFixtureStatus(fixture._id)}
                        disabled={syncing === fixture._id}
                        className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {syncing === fixture._id ? 'Syncing...' : 'Sync Status'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FixtureStatusPage() {
  return (
    <AuthGuard>
      <FixtureStatusContent />
    </AuthGuard>
  );
}