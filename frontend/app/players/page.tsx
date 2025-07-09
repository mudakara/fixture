'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Player {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: string;
  teamMemberships?: Array<{
    teamId: {
      _id: string;
      name: string;
    } | string;
    role: string;
  }>;
  statistics: {
    activitiesPlayed: number;
    totalMatches: number;
    wins: number;
    winRate: number;
  };
}

function PlayersContent() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false
  });

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearch(searchInput);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  useEffect(() => {
    fetchPlayers();
  }, [search]);

  const fetchPlayers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('limit', '50');
      params.append('offset', '0');

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/players?${params.toString()}`,
        { withCredentials: true }
      );
      
      setPlayers(response.data.players);
      setPagination(response.data.pagination);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch players');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Players</h1>
            <p className="mt-2 text-gray-600">Browse and search all players in the system</p>
          </div>

          {/* Search Bar */}
          <div className="bg-white shadow rounded-lg mb-6 p-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or email..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

          {/* Players List */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading players...</p>
            </div>
          ) : players.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No players found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {search ? 'Try adjusting your search criteria.' : 'No players have joined the system yet.'}
              </p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {players.map((player) => (
                  <li key={player._id}>
                    <Link
                      href={`/players/${player._id}`}
                      className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center">
                              <span className="text-white font-medium">
                                {(player.displayName || player.name).charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {player.displayName || player.name}
                            </div>
                            <div className="text-sm text-gray-500">{player.email}</div>
                            <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                {player.role.replace('_', ' ').toUpperCase()}
                              </span>
                              {player.teamMemberships && player.teamMemberships.length > 0 && (
                                <span>
                                  {player.teamMemberships.length} team{player.teamMemberships.length !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <div className="text-gray-900 font-medium">{player.statistics.activitiesPlayed}</div>
                            <div className="text-gray-500 text-xs">Activities</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-900 font-medium">{player.statistics.totalMatches}</div>
                            <div className="text-gray-500 text-xs">Matches</div>
                          </div>
                          <div className="text-center">
                            <div className="text-gray-900 font-medium">{player.statistics.wins}</div>
                            <div className="text-gray-500 text-xs">Wins</div>
                          </div>
                          <div className="text-center">
                            <div className={`font-medium ${
                              player.statistics.winRate >= 60 ? 'text-green-600' :
                              player.statistics.winRate >= 40 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {player.statistics.winRate}%
                            </div>
                            <div className="text-gray-500 text-xs">Win Rate</div>
                          </div>
                          <div>
                            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Pagination Info */}
          {!loading && players.length > 0 && (
            <div className="mt-4 text-sm text-gray-700 text-center">
              Showing {players.length} of {pagination.total} players
            </div>
          )}
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