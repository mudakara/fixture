'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
  category: string;
  minPlayers: number;
  maxPlayers: number;
}

interface Team {
  _id: string;
  name: string;
  eventId: string | { _id: string; name: string };
}

interface Player {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
  role?: string;
  teamMemberships?: Array<{
    teamId: string | { _id: string; name: string };
    eventId: string;
    role: string;
  }>;
}

function CreateAIFixtureContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [sportGames, setSportGames] = useState<SportGame[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    eventId: '',
    sportGameId: '',
    format: 'knockout',
    participantType: 'player',
    participants: [] as string[],
    startDate: '',
    endDate: '',
    aiSettings: {
      optimizationGoals: {
        balanceSkillLevels: true,
        avoidSameTeamFirstRound: true,
        prioritizeCompetitiveMatches: true,
        fairScheduling: false,
      },
      constraints: {
        maxMatchesPerDay: 3,
        minRestBetweenMatches: 60, // minutes
      },
      modelPreferences: {
        provider: 'openai' as 'openai' | 'anthropic' | 'local',
        temperature: 0.3,
        maxRetries: 3,
      }
    },
    settings: {
      thirdPlaceMatch: false,
      matchDuration: 30,
      venue: '',
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0
    }
  });

  // Check permissions
  const canCreateAIFixtures = user?.role === 'super_admin' || user?.role === 'admin';
  
  useEffect(() => {
    if (!canCreateAIFixtures) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [canCreateAIFixtures, router]);

  const fetchData = async () => {
    setDataLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('API URL not configured');
      }

      // Fetch data with delays to avoid rate limiting
      const eventsRes = await axios.get(`${apiUrl}/events`, { withCredentials: true });
      setEvents(eventsRes.data.events);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const sportGamesRes = await axios.get(`${apiUrl}/sportgames`, { withCredentials: true });
      setSportGames(sportGamesRes.data.sportGames);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const playersRes = await axios.get(`${apiUrl}/users`, { withCredentials: true });
      const allUsers = playersRes.data.users || [];
      setPlayers(allUsers.filter((user: Player) => 
        user.role !== 'super_admin' && 
        user.role !== 'admin'
      ));
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const teamsRes = await axios.get(`${apiUrl}/teams`, { withCredentials: true });
      setTeams(teamsRes.data.teams || []);
      
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      setError(error.response?.data?.error || 'Failed to load data');
    } finally {
      setDataLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/ai-generate`,
        formData,
        { withCredentials: true }
      );

      if (response.data.success) {
        router.push(`/fixtures/${response.data.fixture._id}`);
      }
    } catch (error: any) {
      if (error.response?.data?.fallbackAvailable) {
        // Could offer to retry with standard generation
        setError(`AI generation failed: ${error.response.data.error}. You can try again or use standard fixture creation.`);
      } else {
        setError(error.response?.data?.error || 'Failed to create AI fixture');
      }
      setLoading(false);
    }
  };

  const handleEventChange = (eventId: string) => {
    setFormData({ ...formData, eventId, participants: [] });
  };

  const handleParticipantToggle = (participantId: string) => {
    const participants = [...formData.participants];
    const index = participants.indexOf(participantId);
    
    if (index > -1) {
      participants.splice(index, 1);
    } else {
      participants.push(participantId);
    }
    
    setFormData({ ...formData, participants });
  };

  if (!canCreateAIFixtures) {
    return null;
  }

  // Get available participants
  const availableParticipants = formData.participantType === 'team' 
    ? teams.filter(team => {
        const teamEventId = typeof team.eventId === 'string' ? team.eventId : team.eventId._id;
        return teamEventId === formData.eventId;
      })
    : players.filter(player => 
        player.teamMemberships?.some(membership => membership.eventId === formData.eventId)
      );

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {dataLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading data...</p>
              </div>
            </div>
          ) : error && !loading ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-6">
                <Link href="/ai-fixtures" className="text-indigo-600 hover:text-indigo-900 mb-2 inline-block">
                  ← Back to AI Fixtures
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Create AI-Powered Fixture</h1>
                <p className="text-gray-600 mt-1">Let AI optimize your tournament for the best possible matchups</p>
              </div>

              {/* AI Benefits Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <h3 className="text-sm font-medium text-blue-800">AI Optimization Benefits</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Balanced skill levels across brackets for competitive matches</li>
                        <li>Smart team separation to avoid early same-team matchups</li>
                        <li>Optimal scheduling considering rest times and venue availability</li>
                        <li>Data-driven seeding based on historical performance</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fixture Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        required
                        placeholder="e.g., Summer Championship 2024"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Describe your tournament..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Event <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.eventId}
                          onChange={(e) => handleEventChange(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        >
                          <option value="">Select Event</option>
                          {events.map((event) => (
                            <option key={event._id} value={event._id}>
                              {event.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sport/Game <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.sportGameId}
                          onChange={(e) => setFormData({ ...formData, sportGameId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          required
                        >
                          <option value="">Select Sport/Game</option>
                          {sportGames.map((sg) => (
                            <option key={sg._id} value={sg._id}>
                              {sg.title} ({sg.type})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Settings */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">AI Optimization Settings</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Optimization Goals</h3>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.aiSettings.optimizationGoals.balanceSkillLevels}
                            onChange={(e) => setFormData({
                              ...formData,
                              aiSettings: {
                                ...formData.aiSettings,
                                optimizationGoals: {
                                  ...formData.aiSettings.optimizationGoals,
                                  balanceSkillLevels: e.target.checked
                                }
                              }
                            })}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Balance skill levels across brackets
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.aiSettings.optimizationGoals.avoidSameTeamFirstRound}
                            onChange={(e) => setFormData({
                              ...formData,
                              aiSettings: {
                                ...formData.aiSettings,
                                optimizationGoals: {
                                  ...formData.aiSettings.optimizationGoals,
                                  avoidSameTeamFirstRound: e.target.checked
                                }
                              }
                            })}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Avoid same-team matchups in early rounds
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.aiSettings.optimizationGoals.prioritizeCompetitiveMatches}
                            onChange={(e) => setFormData({
                              ...formData,
                              aiSettings: {
                                ...formData.aiSettings,
                                optimizationGoals: {
                                  ...formData.aiSettings.optimizationGoals,
                                  prioritizeCompetitiveMatches: e.target.checked
                                }
                              }
                            })}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Prioritize competitive matches
                          </span>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.aiSettings.optimizationGoals.fairScheduling}
                            onChange={(e) => setFormData({
                              ...formData,
                              aiSettings: {
                                ...formData.aiSettings,
                                optimizationGoals: {
                                  ...formData.aiSettings.optimizationGoals,
                                  fairScheduling: e.target.checked
                                }
                              }
                            })}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            Ensure fair scheduling (equal rest times)
                          </span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-900 mb-2">AI Model Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            AI Provider
                          </label>
                          <select
                            value={formData.aiSettings.modelPreferences.provider}
                            onChange={(e) => setFormData({
                              ...formData,
                              aiSettings: {
                                ...formData.aiSettings,
                                modelPreferences: {
                                  ...formData.aiSettings.modelPreferences,
                                  provider: e.target.value as 'openai' | 'anthropic' | 'local'
                                }
                              }
                            })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="openai">OpenAI GPT-4</option>
                            <option value="anthropic">Claude</option>
                            <option value="local">Local Algorithm</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Creativity Level
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={formData.aiSettings.modelPreferences.temperature}
                            onChange={(e) => setFormData({
                              ...formData,
                              aiSettings: {
                                ...formData.aiSettings,
                                modelPreferences: {
                                  ...formData.aiSettings.modelPreferences,
                                  temperature: parseFloat(e.target.value)
                                }
                              }
                            })}
                            className="w-full"
                          />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Conservative</span>
                            <span>{formData.aiSettings.modelPreferences.temperature}</span>
                            <span>Creative</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tournament Format */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Tournament Format</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Format <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.format}
                        onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="knockout">Knockout</option>
                        <option value="roundrobin">Round Robin</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Participant Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.participantType}
                        onChange={(e) => setFormData({ ...formData, participantType: e.target.value, participants: [] })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        required
                      >
                        <option value="player">Players</option>
                        <option value="team">Teams</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Participants Selection */}
                <div className="bg-white shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">
                    Select Participants ({formData.participants.length} selected)
                  </h2>
                  
                  {!formData.eventId ? (
                    <p className="text-gray-500">Please select an event first</p>
                  ) : availableParticipants.length === 0 ? (
                    <p className="text-gray-500">
                      No {formData.participantType === 'team' ? 'teams' : 'players'} available for the selected event.
                    </p>
                  ) : (
                    <>
                      <div className="mb-3 bg-indigo-50 border border-indigo-200 rounded-md p-3">
                        <p className="text-sm text-indigo-800">
                          <strong>AI Tip:</strong> Select at least 8-16 participants for optimal AI bracket generation. 
                          The AI will analyze skill levels and create balanced matchups.
                        </p>
                      </div>
                      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-md">
                        {availableParticipants.map((participant: any) => (
                          <label
                            key={participant._id}
                            className="flex items-center px-4 py-3 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={formData.participants.includes(participant._id)}
                              onChange={() => handleParticipantToggle(participant._id)}
                              className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                            <span className="ml-3 text-sm text-gray-900">
                              {participant.name || participant.displayName}
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3">
                  <Link
                    href="/ai-fixtures"
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={loading || formData.participants.length < 2}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating with AI...
                      </>
                    ) : (
                      'Create AI Fixture'
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreateAIFixturePage() {
  return (
    <AuthGuard>
      <CreateAIFixtureContent />
    </AuthGuard>
  );
}