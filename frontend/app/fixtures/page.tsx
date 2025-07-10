'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Event {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface SportGame {
  _id: string;
  title: string;
  type: string;
}

interface Fixture {
  _id: string;
  name: string;
  description?: string;
  eventId: Event;
  sportGameId: SportGame;
  format: 'knockout' | 'roundrobin';
  participantType: 'player' | 'team';
  participants: string[];
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

function FixturesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [events, setEvents] = useState<Event[]>([]);

  // Check permissions
  const canCreateFixtures = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'captain' || user?.role === 'vicecaptain';
  
  useEffect(() => {
    fetchFixtures();
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/events`,
        { withCredentials: true }
      );
      setEvents(response.data.events);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const fetchFixtures = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (eventFilter !== 'all') params.eventId = eventFilter;
      if (formatFilter !== 'all') params.format = formatFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures`,
        { 
          params,
          withCredentials: true 
        }
      );
      setFixtures(response.data.fixtures);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError(err.response?.data?.error || 'Failed to fetch fixtures');
      }
    } finally {
      setLoading(false);
    }
  }, [eventFilter, formatFilter, statusFilter]);

  useEffect(() => {
    // Add a small delay to debounce rapid filter changes
    const timeoutId = setTimeout(() => {
      fetchFixtures();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [fetchFixtures]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: { [key: string]: string } = {
      draft: 'bg-gray-200 text-gray-900 border border-gray-400',
      scheduled: 'bg-blue-200 text-blue-900 border border-blue-400',
      in_progress: 'bg-yellow-200 text-yellow-900 border border-yellow-400',
      completed: 'bg-green-200 text-green-900 border border-green-400',
      cancelled: 'bg-red-200 text-red-900 border border-red-400'
    };
    return colors[status] || 'bg-gray-200 text-gray-900 border border-gray-400';
  };

  const getFormatBadgeColor = (format: string) => {
    return format === 'knockout' 
      ? 'bg-purple-200 text-purple-900 border border-purple-400' 
      : 'bg-indigo-200 text-indigo-900 border border-indigo-400';
  };

  const handleDelete = async (fixtureId: string, fixtureName: string) => {
    if (!confirm(`Are you sure you want to delete fixture "${fixtureName}"?`)) {
      return;
    }

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixtureId}`,
        { withCredentials: true }
      );
      
      // Refresh the list
      fetchFixtures();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete fixture');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-lg font-semibold text-gray-700">Loading fixtures...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-red-100 border border-red-400 text-red-900 px-4 py-3 rounded-lg mx-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-bold">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900">Fixtures</h1>
              <p className="text-gray-700 font-medium mt-1">Manage tournament fixtures and matches</p>
            </div>
            {canCreateFixtures && (
              <Link
                href="/fixtures/create"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center font-bold shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Fixture
              </Link>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white shadow-md rounded-lg mb-6 p-4 border border-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Event Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Event</label>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-semibold"
                >
                  <option value="all">All Events</option>
                  {events.map((event) => (
                    <option key={event._id} value={event._id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Format</label>
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-semibold"
                >
                  <option value="all">All Formats</option>
                  <option value="knockout">Knockout</option>
                  <option value="roundrobin">Round Robin</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-400 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 font-semibold"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fixtures Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fixtures.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-white rounded-lg shadow-md border border-gray-300">
                <svg className="mx-auto h-12 w-12 text-gray-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-gray-700 font-semibold text-lg">No fixtures found</p>
                <p className="text-gray-600 mt-1">Try adjusting your filters or create a new fixture</p>
              </div>
            ) : (
              fixtures.map((fixture) => (
                <div key={fixture._id} className="bg-white overflow-hidden shadow-md rounded-lg hover:shadow-xl transition-shadow border border-gray-300">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900 truncate">
                        {fixture.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getFormatBadgeColor(fixture.format)}`}>
                          {fixture.format === 'knockout' ? 'Knockout' : 'Round Robin'}
                        </span>
                        {fixture.status !== 'draft' && (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeColor(fixture.status)}`}>
                            {fixture.status.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {fixture.description && (
                      <p className="text-sm text-gray-600 mb-3">{fixture.description}</p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-700">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">{fixture.eventId.name}</span>
                      </div>
                      
                      <div className="flex items-center text-gray-700">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">{fixture.sportGameId.title}</span>
                        <span className="text-gray-600 ml-1">({fixture.sportGameId.type})</span>
                      </div>

                      <div className="flex items-center text-gray-700">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-semibold">{fixture.participants.length} {fixture.participantType === 'team' ? 'Teams' : 'Players'}</span>
                      </div>

                      <div className="flex items-center text-gray-700">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-semibold">{formatDate(fixture.startDate)}</span>
                        {fixture.endDate && <span className="font-semibold"> - {formatDate(fixture.endDate)}</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-100 px-5 py-3 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700">
                        Created by <span className="font-semibold">{fixture.createdBy.name}</span>
                      </p>
                      <div className="flex items-center space-x-3">
                        <Link
                          href={`/fixtures/${fixture._id}`}
                          className="text-indigo-700 hover:text-indigo-900 text-sm font-bold"
                        >
                          View Details
                        </Link>
                        {(user?.role === 'super_admin' || user?.role === 'admin' || fixture.createdBy._id === user?.id) && (
                          <button
                            onClick={() => handleDelete(fixture._id, fixture.name)}
                            className="text-red-700 hover:text-red-900 text-sm font-bold"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FixturesPage() {
  return (
    <AuthGuard>
      <FixturesContent />
    </AuthGuard>
  );
}