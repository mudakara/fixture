'use client';

import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  user: {
    name: string;
    email: string;
    role: string;
    displayName?: string;
  };
  overview?: {
    totalUsers?: number;
    totalTeams?: number;
    totalEvents?: number;
    upcomingEvents?: number;
    ongoingEvents?: number;
    pastEvents?: number;
    totalTeamsManaged?: number;
    totalPlayersManaged?: number;
  };
  usersByRole?: {
    [key: string]: number;
  };
  recentActivities?: Array<{
    action: string;
    entity: string;
    user: { name: string; email: string } | null;
    timestamp: string;
    details: any;
  }>;
  myTeams?: {
    total: number;
    list: Array<{
      _id?: string;
      teamId?: string;
      name?: string;
      teamName?: string;
      role: string;
      playerCount?: number;
      joinedAt?: string;
      event: {
        _id: string;
        name: string;
        startDate: string;
        endDate: string;
      };
    }>;
  };
  recentEvents?: Array<{
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  }>;
  upcomingEventsList?: Array<{
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
  }>;
}

function DashboardContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/dashboard/stats`,
        { withCredentials: true }
      );
      setStats(response.data.stats);
      setLoading(false);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch dashboard statistics';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'create':
        return '➕';
      case 'update':
        return '✏️';
      case 'delete':
        return '🗑️';
      case 'login':
        return '🔑';
      default:
        return '📝';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      upcoming: 'bg-blue-100 text-blue-800',
      ongoing: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-800'
    };
    return styles[status as keyof typeof styles] || styles.ended;
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user || !stats) return <div>No data available</div>;

  const isAdmin = user.role === 'super_admin' || user.role === 'admin';
  const isTeamLeader = user.role === 'captain' || user.role === 'vicecaptain';

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Welcome Section */}
          <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {stats.user.displayName || stats.user.name}!
              </h1>
              <p className="text-gray-600 mt-1">
                Role: <span className="font-medium capitalize">{stats.user.role.replace('_', ' ')}</span>
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
            {isAdmin && (
              <>
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.overview?.totalUsers || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-5 py-3">
                    <Link href="/users" className="text-sm text-indigo-600 hover:text-indigo-500">
                      View all →
                    </Link>
                  </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-500 truncate">Total Teams</dt>
                          <dd className="text-lg font-medium text-gray-900">{stats.overview?.totalTeams || 0}</dd>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-5 py-3">
                    <Link href="/teams" className="text-sm text-indigo-600 hover:text-indigo-500">
                      View all →
                    </Link>
                  </div>
                </div>
              </>
            )}

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Events</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.overview?.totalEvents || stats.recentEvents?.length || 0}</dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <Link href="/events" className="text-sm text-indigo-600 hover:text-indigo-500">
                  View all →
                </Link>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-2xl font-semibold text-blue-600">{stats.overview?.upcomingEvents || 0}</p>
                    <p className="text-xs text-gray-500">Upcoming</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-green-600">{stats.overview?.ongoingEvents || 0}</p>
                    <p className="text-xs text-gray-500">Ongoing</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-600">{stats.overview?.pastEvents || 0}</p>
                    <p className="text-xs text-gray-500">Past</p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <p className="text-sm text-gray-500 text-center">Event Status</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-1">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
                  <div className="space-y-3">
                    {isAdmin ? (
                      <>
                        <Link
                          href="/events/create"
                          className="w-full flex items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Create New Event
                        </Link>
                        <Link
                          href="/users"
                          className="w-full flex items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          Manage Users
                        </Link>
                        <Link
                          href="/teams"
                          className="w-full flex items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Manage Teams
                        </Link>
                      </>
                    ) : isTeamLeader ? (
                      <>
                        {stats.myTeams?.list.map((team) => (
                          <Link
                            key={team._id || team.teamId}
                            href={`/teams/${team._id || team.teamId}`}
                            className="w-full flex items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Manage {team.name || team.teamName} ({team.role})
                          </Link>
                        ))}
                      </>
                    ) : (
                      <Link
                        href="/teams"
                        className="w-full flex items-center px-4 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg className="mr-3 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        View My Teams
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              {/* My Teams Section for Team Leaders and Players */}
              {(isTeamLeader || user.role === 'player') && stats.myTeams && stats.myTeams.total > 0 && (
                <div className="bg-white overflow-hidden shadow rounded-lg mt-6">
                  <div className="px-4 py-5 sm:p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">My Teams</h2>
                    <div className="space-y-3">
                      {stats.myTeams.list.map((team) => (
                        <div key={team._id || team.teamId} className="border-l-4 border-indigo-400 pl-4">
                          <h3 className="text-sm font-medium text-gray-900">
                            {team.name || team.teamName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Role: {team.role} • Event: {team.event.name}
                          </p>
                          {team.playerCount && (
                            <p className="text-sm text-gray-500">
                              {team.playerCount} players
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Events & Activities */}
            <div className="lg:col-span-2">
              {/* Recent Events */}
              {stats.recentEvents && stats.recentEvents.length > 0 && (
                <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
                  <div className="px-4 py-5 sm:p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Events</h2>
                    <div className="space-y-3">
                      {stats.recentEvents.map((event) => (
                        <Link
                          key={event._id}
                          href={`/events/${event._id}`}
                          className="block hover:bg-gray-50 -mx-2 px-2 py-2 rounded-md transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-gray-900">{event.name}</h3>
                              <p className="text-sm text-gray-500">
                                {formatDate(event.startDate)} - {formatDate(event.endDate)}
                              </p>
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(event.status)}`}>
                              {event.status}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Activities - Admin Only */}
              {isAdmin && stats.recentActivities && stats.recentActivities.length > 0 && (
                <div className="bg-white overflow-hidden shadow rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activities</h2>
                    <div className="flow-root">
                      <ul className="-mb-8">
                        {stats.recentActivities.map((activity, index) => (
                          <li key={index}>
                            <div className="relative pb-8">
                              {index !== stats.recentActivities!.length - 1 && (
                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                              )}
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                                    <span className="text-sm">{getActionIcon(activity.action)}</span>
                                  </span>
                                </div>
                                <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                  <div>
                                    <p className="text-sm text-gray-900">
                                      {activity.user?.name || 'System'} {activity.action}d {activity.entity}
                                      {activity.details?.playerName && ` "${activity.details.playerName}"`}
                                      {activity.details?.teamName && ` in team "${activity.details.teamName}"`}
                                    </p>
                                  </div>
                                  <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                    <time dateTime={activity.timestamp}>
                                      {formatTime(activity.timestamp)}
                                    </time>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
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

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}