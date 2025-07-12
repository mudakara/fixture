'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { use } from 'react';
import axios from 'axios';
import Link from 'next/link';

interface Params {
  id: string;
}

interface PlayerProfile {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
  role: string;
  createdAt: string;
  teams: Array<{
    _id: string;
    name: string;
    eventId: {
      _id: string;
      name: string;
    };
  }>;
}

interface Achievement {
  activityId: string;
  activityName: string;
  activityType: string;
  eventId: string;
  eventName: string;
  position: 1 | 2 | 3;
  points: number;
  isDoubles: boolean;
  partnerId?: string;
  partnerName?: string;
}

interface Statistics {
  totalPoints: number;
  firstPlaces: number;
  secondPlaces: number;
  thirdPlaces: number;
  totalActivities: number;
}

interface Match {
  _id: string;
  round: number;
  matchNumber: number;
  homeParticipant: any;
  awayParticipant: any;
  homePartner?: any;
  awayPartner?: any;
  homeScore?: number;
  awayScore?: number;
  winner?: any;
  status: string;
  actualDate?: string;
  scheduledDate?: string;
  playerSide: 'home' | 'away';
  result: string;
  fixture: {
    name: string;
    eventName: string;
    activityName: string;
    format: string;
  };
}

function PlayerProfileContent({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'matches'>('overview');
  const [matchesLoading, setMatchesLoading] = useState(false);

  useEffect(() => {
    fetchPlayerProfile();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (activeTab === 'matches' && matches.length === 0) {
      fetchMatches();
    }
  }, [activeTab]);

  const fetchPlayerProfile = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/players/${resolvedParams.id}/profile`,
        { withCredentials: true }
      );
      
      console.log('Player Profile Response:', response.data);
      console.log('Statistics:', response.data.statistics);
      console.log('Podium calculation:', {
        firstPlaces: response.data.statistics.firstPlaces,
        secondPlaces: response.data.statistics.secondPlaces,
        thirdPlaces: response.data.statistics.thirdPlaces,
        totalActivities: response.data.statistics.totalActivities,
        podiumTotal: response.data.statistics.firstPlaces + response.data.statistics.secondPlaces + response.data.statistics.thirdPlaces,
        podiumRate: Math.round(((response.data.statistics.firstPlaces + response.data.statistics.secondPlaces + response.data.statistics.thirdPlaces) / response.data.statistics.totalActivities) * 100)
      });
      setProfile(response.data.player);
      setStatistics(response.data.statistics);
      setAchievements(response.data.achievements);
      
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch player profile');
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      setMatchesLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/players/${resolvedParams.id}/matches?limit=50`,
        { withCredentials: true }
      );
      
      setMatches(response.data.matches);
      setMatchesLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch matches:', err);
      setMatchesLoading(false);
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
              <p className="mt-4 text-gray-600">Loading player profile...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error || 'Player not found'}</p>
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
          {/* Profile Header */}
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-16 w-16 rounded-full bg-indigo-500 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {(profile.displayName || profile.name).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {profile.displayName || profile.name}
                    </h1>
                    <p className="text-sm text-gray-500">{profile.email}</p>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {profile.role.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">
                        Member since {new Date(profile.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Statistics Summary */}
                {statistics && (
                  <div className="flex items-center space-x-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-600">{statistics.totalPoints}</div>
                      <div className="text-sm text-gray-500">Total Points</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-500">{statistics.firstPlaces}</div>
                      <div className="text-sm text-gray-500">🥇 Gold</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-500">{statistics.secondPlaces}</div>
                      <div className="text-sm text-gray-500">🥈 Silver</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-500">{statistics.thirdPlaces}</div>
                      <div className="text-sm text-gray-500">🥉 Bronze</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white shadow rounded-lg">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`py-2 px-6 block hover:text-indigo-600 focus:outline-none ${
                    activeTab === 'overview'
                      ? 'border-b-2 font-medium text-indigo-600 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('achievements')}
                  className={`py-2 px-6 block hover:text-indigo-600 focus:outline-none ${
                    activeTab === 'achievements'
                      ? 'border-b-2 font-medium text-indigo-600 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Achievements ({achievements.length})
                </button>
                <button
                  onClick={() => setActiveTab('matches')}
                  className={`py-2 px-6 block hover:text-indigo-600 focus:outline-none ${
                    activeTab === 'matches'
                      ? 'border-b-2 font-medium text-indigo-600 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Match History
                </button>
              </nav>
            </div>

            <div className="p-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Teams */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Team Memberships</h3>
                    {profile.teams.length === 0 ? (
                      <p className="text-gray-500">Not a member of any team yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {profile.teams.map((team) => (
                          <Link
                            key={team._id}
                            href={`/teams/${team._id}`}
                            className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <h4 className="font-medium text-gray-900">{team.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{team.eventId.name}</p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Performance Summary */}
                  {statistics && statistics.totalActivities > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Summary</h3>
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{statistics.totalActivities}</div>
                            <div className="text-sm text-gray-600">Activities Played</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {statistics.totalPoints > 0 ? Math.round(statistics.totalPoints / statistics.totalActivities) : 0}
                            </div>
                            <div className="text-sm text-gray-600">Avg Points/Activity</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {Math.round((statistics.firstPlaces / statistics.totalActivities) * 100)}%
                            </div>
                            <div className="text-sm text-gray-600">Win Rate</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {Math.round(((statistics.firstPlaces + statistics.secondPlaces + statistics.thirdPlaces) / statistics.totalActivities) * 100)}%
                            </div>
                            <div className="text-sm text-gray-600">Podium Rate</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Achievements Tab */}
              {activeTab === 'achievements' && (
                <div className="space-y-4">
                  {achievements.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No achievements yet. Start participating in activities!</p>
                  ) : (
                    achievements.map((achievement, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="text-3xl">
                              {achievement.position === 1 ? '🥇' : achievement.position === 2 ? '🥈' : '🥉'}
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{achievement.activityName}</h4>
                              <p className="text-sm text-gray-500">{achievement.eventName}</p>
                              {achievement.isDoubles && achievement.partnerName && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Partner: {achievement.partnerName}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-indigo-600">{achievement.points}</div>
                            <div className="text-sm text-gray-500">points</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Matches Tab */}
              {activeTab === 'matches' && (
                <div className="space-y-4">
                  {matchesLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading matches...</p>
                    </div>
                  ) : matches.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No matches played yet.</p>
                  ) : (
                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                      <table className="min-w-full divide-y divide-gray-300">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Activity
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Event
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Round
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Score
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Result
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {matches.map((match) => (
                            <tr key={match._id} className={match.result === 'won' ? 'bg-green-50' : match.result === 'lost' ? 'bg-red-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {match.fixture.activityName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.fixture.eventName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.fixture.format === 'knockout' ? `Round ${match.round}` : `Match ${match.matchNumber}`}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {match.status === 'completed' && match.homeScore !== undefined && match.awayScore !== undefined ? (
                                  <span className={`font-medium ${
                                    match.playerSide === 'home' 
                                      ? match.homeScore > match.awayScore ? 'text-green-600' : 'text-red-600'
                                      : match.awayScore > match.homeScore ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {match.homeScore} - {match.awayScore}
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                {match.result === 'won' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Won
                                  </span>
                                ) : match.result === 'lost' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Lost
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    {match.status}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {match.actualDate || match.scheduledDate ? 
                                  new Date(match.actualDate || match.scheduledDate!).toLocaleDateString() : 
                                  '-'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

export default function PlayerProfilePage({ params }: { params: Promise<Params> }) {
  return (
    <AuthGuard>
      <PlayerProfileContent params={params} />
    </AuthGuard>
  );
}