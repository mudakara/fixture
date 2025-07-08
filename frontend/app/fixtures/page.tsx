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
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getFormatBadgeColor = (format: string) => {
    return format === 'knockout' 
      ? 'bg-purple-100 text-purple-800' 
      : 'bg-indigo-100 text-indigo-800';
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Fixtures</h1>
              <p className="text-gray-600 mt-1">Manage tournament fixtures and matches</p>
            </div>
            {canCreateFixtures && (
              <Link
                href="/fixtures/create"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Fixture
              </Link>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white shadow rounded-lg mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Event Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                <select
                  value={formatFilter}
                  onChange={(e) => setFormatFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="all">All Formats</option>
                  <option value="knockout">Knockout</option>
                  <option value="roundrobin">Round Robin</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
              <div className="col-span-full text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">No fixtures found</p>
              </div>
            ) : (
              fixtures.map((fixture) => (
                <div key={fixture._id} className="bg-white overflow-hidden shadow rounded-lg hover:shadow-lg transition-shadow">
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {fixture.name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getFormatBadgeColor(fixture.format)}`}>
                          {fixture.format === 'knockout' ? 'Knockout' : 'Round Robin'}
                        </span>
                        {fixture.status !== 'draft' && (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(fixture.status)}`}>
                            {fixture.status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {fixture.description && (
                      <p className="text-sm text-gray-600 mb-3">{fixture.description}</p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-500">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {fixture.eventId.name}
                      </div>
                      
                      <div className="flex items-center text-gray-500">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {fixture.sportGameId.title} ({fixture.sportGameId.type})
                      </div>

                      <div className="flex items-center text-gray-500">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {fixture.participants.length} {fixture.participantType === 'team' ? 'Teams' : 'Players'}
                      </div>

                      <div className="flex items-center text-gray-500">
                        <svg className="flex-shrink-0 mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(fixture.startDate)}
                        {fixture.endDate && ` - ${formatDate(fixture.endDate)}`}
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-5 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        Created by {fixture.createdBy.name}
                      </p>
                      <div className="flex items-center space-x-3">
                        <Link
                          href={`/fixtures/${fixture._id}`}
                          className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                        >
                          View Details
                        </Link>
                        {(user?.role === 'super_admin' || user?.role === 'admin' || fixture.createdBy._id === user?._id) && (
                          <button
                            onClick={() => handleDelete(fixture._id, fixture.name)}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
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