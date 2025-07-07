'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/utils/imageUrl';

interface User {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
}

interface Team {
  _id: string;
  name: string;
  teamLogo?: string;
  eventId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  captainId: {
    _id: string;
    name: string;
    email: string;
    displayName?: string;
  };
  viceCaptainId: {
    _id: string;
    name: string;
    email: string;
    displayName?: string;
  };
  players: Array<{
    _id: string;
    name: string;
    email: string;
    displayName?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

function TeamDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'players'>('overview');
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchPlayer, setSearchPlayer] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [bulkPlayerNames, setBulkPlayerNames] = useState('');
  const [bulkAddLoading, setBulkAddLoading] = useState(false);

  useEffect(() => {
    fetchTeamDetails();
  }, [resolvedParams.id]);

  // Handle escape key for modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddPlayerModal) {
          setShowAddPlayerModal(false);
          setSelectedPlayer(null);
          setSearchPlayer('');
        }
        if (showBulkAddModal) {
          setShowBulkAddModal(false);
          setBulkPlayerNames('');
        }
      }
    };
    
    if (showAddPlayerModal || showBulkAddModal) {
      document.addEventListener('keydown', handleEscape);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showAddPlayerModal, showBulkAddModal]);

  const fetchTeamDetails = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/teams/${resolvedParams.id}`,
        { withCredentials: true }
      );
      setTeam(response.data.team);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch team details');
      setLoading(false);
    }
  };

  const fetchAvailableUsers = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        { withCredentials: true }
      );
      // Filter out users already in the team
      const teamMemberIds = team?.players.map(p => p._id) || [];
      teamMemberIds.push(team?.captainId._id || '');
      teamMemberIds.push(team?.viceCaptainId._id || '');
      
      const available = response.data.users.filter((u: User) => 
        !teamMemberIds.includes(u._id)
      );
      setAvailableUsers(available);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleAddPlayer = async () => {
    if (!selectedPlayer) return;
    
    setAddingPlayer(true);
    setError(null);
    
    try {
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/teams/${resolvedParams.id}/players`,
        { playerId: selectedPlayer },
        { withCredentials: true }
      );
      
      // Refresh team data
      await fetchTeamDetails();
      setShowAddPlayerModal(false);
      setSelectedPlayer(null);
      setSearchPlayer('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add player');
    } finally {
      setAddingPlayer(false);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to remove this player from the team?')) {
      return;
    }
    
    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/teams/${resolvedParams.id}/players/${playerId}`,
        { withCredentials: true }
      );
      
      // Refresh team data
      await fetchTeamDetails();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove player');
    }
  };

  const handleBulkAddPlayers = async () => {
    if (!bulkPlayerNames.trim()) return;
    
    setBulkAddLoading(true);
    setError(null);
    
    try {
      // Split by comma and trim each name
      const playerNames = bulkPlayerNames
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
      
      if (playerNames.length === 0) {
        setError('Please enter at least one player name');
        return;
      }
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/teams/${resolvedParams.id}/players/bulk`,
        { playerNames },
        { withCredentials: true }
      );
      
      if (response.data.errors && response.data.errors.length > 0) {
        const errorMessages = response.data.errors.map((e: any) => `${e.name}: ${e.error}`).join('\n');
        setError(`Some players could not be created:\n${errorMessages}`);
      }
      
      // Refresh team data
      await fetchTeamDetails();
      setShowBulkAddModal(false);
      setBulkPlayerNames('');
      
      if (response.data.createdPlayers.length > 0) {
        alert(`Successfully created ${response.data.createdPlayers.length} players`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create players');
    } finally {
      setBulkAddLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const canManageTeam = () => {
    const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';
    const isCaptain = team?.captainId._id === user?._id;
    const isViceCaptain = team?.viceCaptainId._id === user?._id;
    return isAdmin || isCaptain || isViceCaptain;
  };

  const filteredUsers = availableUsers.filter(u =>
    (u.displayName || u.name).toLowerCase().includes(searchPlayer.toLowerCase()) ||
    u.email.toLowerCase().includes(searchPlayer.toLowerCase())
  );

  if (loading) return <div>Loading...</div>;
  if (error && !team) return <div>Error: {error}</div>;
  if (!team) return <div>Team not found</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Team Header */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-start space-x-5">
                <div className="flex-shrink-0">
                  {team.teamLogo ? (
                    <div className="relative h-24 w-24 rounded-lg overflow-hidden">
                      <Image
                        src={getImageUrl(team.teamLogo)}
                        alt={team.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-24 w-24 rounded-lg bg-gray-200 flex items-center justify-center">
                      <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
                      <p className="mt-1 text-sm text-gray-500">
                        Event: <Link href={`/events/${team.eventId._id}`} className="text-indigo-600 hover:text-indigo-500">
                          {team.eventId.name}
                        </Link>
                      </p>
                    </div>
                    {canManageTeam() && (
                      <Link
                        href={`/teams/${team._id}/edit`}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit Team
                      </Link>
                    )}
                  </div>
                  
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Captain</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {team.captainId.displayName || team.captainId.name}
                        <span className="text-gray-500 text-xs block">{team.captainId.email}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Vice Captain</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {team.viceCaptainId.displayName || team.viceCaptainId.name}
                        <span className="text-gray-500 text-xs block">{team.viceCaptainId.email}</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Total Players</dt>
                      <dd className="mt-1 text-sm text-gray-900">{team.players.length + 2} (including captains)</dd>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
              {error}
            </div>
          )}

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
                  onClick={() => setActiveTab('players')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    activeTab === 'players'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Players ({team.players.length})
                </button>
              </nav>
            </div>

            <div className="px-4 py-5 sm:p-6">
              {activeTab === 'overview' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Team Information</h3>
                    <dl className="mt-4 space-y-4">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Event Duration</dt>
                        <dd className="mt-1 text-sm text-gray-900">
                          {formatDate(team.eventId.startDate)} to {formatDate(team.eventId.endDate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Created</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatDate(team.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                        <dd className="mt-1 text-sm text-gray-900">{formatDate(team.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Team Roster</h3>
                    {canManageTeam() && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            setError(null); // Clear any previous errors
                            setShowAddPlayerModal(true);
                            fetchAvailableUsers();
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add Player
                        </button>
                        <button
                          onClick={() => {
                            setError(null);
                            setShowBulkAddModal(true);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          Bulk Add
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {/* Captain */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-600 text-white">
                              Captain
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {team.captainId.displayName || team.captainId.name}
                            </p>
                            <p className="text-sm text-gray-500">{team.captainId.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Vice Captain */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-600 text-white">
                              Vice Captain
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {team.viceCaptainId.displayName || team.viceCaptainId.name}
                            </p>
                            <p className="text-sm text-gray-500">{team.viceCaptainId.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Players */}
                    {team.players.length === 0 ? (
                      <div className="text-center py-6 text-gray-500">
                        <p>No players added yet.</p>
                      </div>
                    ) : (
                      team.players.map((player) => (
                        <div key={player._id} className="bg-white border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-white">
                                  Player
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {player.displayName || player.name}
                                </p>
                                <p className="text-sm text-gray-500">{player.email}</p>
                              </div>
                            </div>
                            {canManageTeam() && (
                              <button
                                onClick={() => handleRemovePlayer(player._id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddPlayerModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity" 
              aria-hidden="true"
              onClick={() => {
                setShowAddPlayerModal(false);
                setSelectedPlayer(null);
                setSearchPlayer('');
              }}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Add Player to Team</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search for a player
                  </label>
                  <input
                    type="text"
                    value={searchPlayer}
                    onChange={(e) => setSearchPlayer(e.target.value)}
                    placeholder="Search by name or email..."
                    autoFocus
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      {searchPlayer ? 'No matching users found' : 'Start typing to search for users'}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((u) => (
                        <button
                          key={u._id}
                          onClick={() => setSelectedPlayer(u._id)}
                          className={`w-full text-left px-3 py-2 rounded-md ${
                            selectedPlayer === u._id
                              ? 'bg-indigo-50 border-indigo-500 border'
                              : 'hover:bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-900">
                            {u.displayName || u.name}
                          </p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  disabled={!selectedPlayer || addingPlayer}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingPlayer ? 'Adding...' : 'Add Player'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPlayerModal(false);
                    setSelectedPlayer(null);
                    setSearchPlayer('');
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Players Modal */}
      {showBulkAddModal && (
        <div className="fixed z-50 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div 
              className="fixed inset-0 transition-opacity" 
              aria-hidden="true"
              onClick={() => {
                setShowBulkAddModal(false);
                setBulkPlayerNames('');
              }}
            >
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Add Players</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter player names separated by commas
                  </label>
                  <textarea
                    value={bulkPlayerNames}
                    onChange={(e) => setBulkPlayerNames(e.target.value)}
                    placeholder="John Doe, Jane Smith, Bob Johnson, Alice Williams"
                    autoFocus
                    rows={5}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Each player will be created with:
                    <ul className="list-disc list-inside mt-1">
                      <li>Email: name@player.local (auto-generated)</li>
                      <li>Default password: changeme123</li>
                      <li>Role: Player</li>
                      <li>Automatically added to this team</li>
                    </ul>
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleBulkAddPlayers}
                  disabled={!bulkPlayerNames.trim() || bulkAddLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkAddLoading ? 'Creating Players...' : 'Create Players'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkAddModal(false);
                    setBulkPlayerNames('');
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AuthGuard>
      <TeamDetailContent params={params} />
    </AuthGuard>
  );
}