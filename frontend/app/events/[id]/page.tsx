'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';

interface Event {
  _id: string;
  name: string;
  description?: string;
  eventImage?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Team {
  _id: string;
  name: string;
  teamLogo?: string;
  captainId: {
    _id: string;
    name: string;
    email: string;
  };
  viceCaptainId: {
    _id: string;
    name: string;
    email: string;
  };
  players: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  playerCount: number;
}

interface EventStats {
  eventName: string;
  status: 'upcoming' | 'ongoing' | 'ended';
  teamCount: number;
  totalPlayers: number;
  startDate: string;
  endDate: string;
}

function EventDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'teams'>('overview');

  useEffect(() => {
    fetchEventDetails();
    fetchEventStats();
  }, [resolvedParams.id]);

  const fetchEventDetails = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/events/${resolvedParams.id}`, {
        withCredentials: true
      });
      setEvent(response.data.event);
      setTeams(response.data.teams);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch event details');
      setLoading(false);
    }
  };

  const fetchEventStats = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/events/${resolvedParams.id}/stats`, {
        withCredentials: true
      });
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      upcoming: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800'
    };
    return styles[status as keyof typeof styles] || styles.ended;
  };

  const canManageEvent = user?.role === 'super_admin' || user?.role === 'admin';

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Event Header */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="relative h-64 bg-gray-200 rounded-t-lg overflow-hidden">
              {event.eventImage ? (
                <Image
                  src={`${process.env.NEXT_PUBLIC_API_URL}${event.eventImage}`}
                  alt={event.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="h-24 w-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                  </svg>
                </div>
              )}
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
                  {event.description && (
                    <p className="mt-2 text-gray-600">{event.description}</p>
                  )}
                  <div className="mt-4 flex items-center space-x-4">
                    {stats && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(stats.status)}`}>
                        {stats.status.charAt(0).toUpperCase() + stats.status.slice(1)}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">
                      {formatDate(event.startDate)} - {formatDate(event.endDate)}
                    </span>
                  </div>
                </div>
                {canManageEvent && (
                  <div className="flex space-x-2">
                    <Link
                      href={`/events/${event._id}/edit`}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <Link
                      href={`/events/${event._id}/teams/create`}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      Add Team
                    </Link>
                  </div>
                )}
              </div>

              {/* Stats Cards */}
              {stats && (
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <div className="bg-gray-50 overflow-hidden rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Teams</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.teamCount}</dd>
                    </div>
                  </div>
                  <div className="bg-gray-50 overflow-hidden rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Players</dt>
                      <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.totalPlayers}</dd>
                    </div>
                  </div>
                  <div className="bg-gray-50 overflow-hidden rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <dt className="text-sm font-medium text-gray-500 truncate">Created By</dt>
                      <dd className="mt-1 text-lg font-medium text-gray-900">{event.createdBy.name}</dd>
                    </div>
                  </div>
                </div>
              )}
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
                  onClick={() => setActiveTab('teams')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'teams'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Teams ({teams.length})
                </button>
              </nav>
            </div>

            <div className="px-4 py-5 sm:p-6">
              {activeTab === 'overview' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Event Information</h3>
                    <dl className="mt-4 space-y-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Duration</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {formatDate(event.startDate)} to {formatDate(event.endDate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Created</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {formatDate(event.createdAt)} by {event.createdBy.name}
                        </dd>
                      </div>
                      {event.description && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500">Description</dt>
                          <dd className="mt-1 text-sm text-gray-900">{event.description}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>
              ) : (
                <div>
                  {teams.length === 0 ? (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No teams yet</h3>
                      <p className="mt-1 text-sm text-gray-500">Get started by creating a team for this event.</p>
                      {canManageEvent && (
                        <div className="mt-6">
                          <Link
                            href={`/events/${event._id}/teams/create`}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                          >
                            Create First Team
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {teams.map((team) => (
                        <Link
                          key={team._id}
                          href={`/teams/${team._id}`}
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center space-x-3">
                            {team.teamLogo ? (
                              <div className="relative h-12 w-12 rounded-full overflow-hidden">
                                <Image
                                  src={`${process.env.NEXT_PUBLIC_API_URL}${team.teamLogo}`}
                                  alt={team.name}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                                <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                              </div>
                            )}
                            <div className="flex-1">
                              <h4 className="text-sm font-medium text-gray-900">{team.name}</h4>
                              <p className="text-sm text-gray-500">{team.playerCount} players</p>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-gray-500">
                            <div>Captain: {team.captainId.name}</div>
                            <div>Vice Captain: {team.viceCaptainId.name}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AuthGuard>
      <EventDetailContent params={params} />
    </AuthGuard>
  );
}