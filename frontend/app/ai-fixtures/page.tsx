'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Fixture {
  _id: string;
  name: string;
  format: 'knockout' | 'roundrobin';
  participantType: 'player' | 'team';
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  eventId: {
    _id: string;
    name: string;
  };
  sportGameId: {
    _id: string;
    title: string;
  };
  participants: string[];
  settings?: {
    aiGenerated?: boolean;
    aiSettings?: {
      optimizationGoals?: any;
      generationMetadata?: {
        modelUsed?: string;
        optimizationScore?: number;
        generationTime?: number;
      };
    };
  };
  createdAt: string;
  createdBy: {
    _id: string;
    name: string;
  };
}

function AIFixturesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check permissions
  const canViewAIFixtures = user?.role === 'super_admin' || user?.role === 'admin';
  
  useEffect(() => {
    if (!canViewAIFixtures) {
      router.push('/dashboard');
      return;
    }
    fetchAIFixtures();
  }, [canViewAIFixtures, router]);

  const fetchAIFixtures = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures?aiGenerated=true`,
        { withCredentials: true }
      );
      setFixtures(response.data.fixtures || []);
    } catch (err: any) {
      console.error('Error fetching AI fixtures:', err);
      setError(err.response?.data?.error || 'Failed to load AI fixtures');
    } finally {
      setLoading(false);
    }
  };

  if (!canViewAIFixtures) {
    return null;
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

  const getFormatColor = (format: string) => {
    return format === 'knockout' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-indigo-100 text-indigo-800';
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI-Generated Fixtures</h1>
              <p className="text-gray-600 mt-1">
                Fixtures created using AI optimization for better matchmaking
              </p>
            </div>
            <Link
              href="/ai-fixtures/create"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create AI Fixture
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading AI fixtures...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error}</p>
            </div>
          ) : fixtures.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Fixtures Yet</h3>
              <p className="text-gray-500 mb-4">
                Create your first AI-powered fixture to get started with intelligent matchmaking.
              </p>
              <Link
                href="/ai-fixtures/create"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Create Your First AI Fixture
              </Link>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {fixtures.map((fixture) => (
                  <li key={fixture._id}>
                    <Link href={`/fixtures/${fixture._id}`} className="block hover:bg-gray-50 px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <p className="text-lg font-medium text-indigo-600 truncate">
                                {fixture.name}
                              </p>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFormatColor(fixture.format)}`}>
                                  {fixture.format}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(fixture.status)}`}>
                                  {fixture.status}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M13 7H7v6h6V7z" />
                                    <path fillRule="evenodd" d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z" clipRule="evenodd" />
                                  </svg>
                                  AI Generated
                                </span>
                              </div>
                            </div>
                            <div className="ml-2 flex-shrink-0 flex">
                              <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                {fixture.participants.length} {fixture.participantType === 'team' ? 'teams' : 'players'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex justify-between">
                            <div className="sm:flex sm:space-x-4">
                              <p className="flex items-center text-sm text-gray-500">
                                <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z" clipRule="evenodd" />
                                </svg>
                                {fixture.eventId?.name || 'No event'}
                              </p>
                              <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                                </svg>
                                {fixture.sportGameId?.title || 'No activity'}
                              </p>
                            </div>
                            {fixture.settings?.aiSettings?.generationMetadata && (
                              <div className="flex items-center space-x-4 text-sm text-gray-500">
                                {fixture.settings.aiSettings.generationMetadata.optimizationScore && (
                                  <span className="flex items-center">
                                    <svg className="h-4 w-4 mr-1 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    {fixture.settings.aiSettings.generationMetadata.optimizationScore}% optimized
                                  </span>
                                )}
                                {fixture.settings.aiSettings.generationMetadata.modelUsed && (
                                  <span className="text-xs text-gray-400">
                                    via {fixture.settings.aiSettings.generationMetadata.modelUsed}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIFixturesPage() {
  return (
    <AuthGuard>
      <AIFixturesContent />
    </AuthGuard>
  );
}