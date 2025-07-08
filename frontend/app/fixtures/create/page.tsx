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
  eventId: string | { _id: string; name: string; startDate: string; endDate: string };
}

interface Player {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
}

function CreateFixtureContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    settings: {
      thirdPlaceMatch: false,
      randomizeSeeds: true,
      avoidSameTeamFirstRound: true,
      rounds: 1,
      homeAndAway: false,
      matchDuration: 30,
      venue: '',
      pointsForWin: 3,
      pointsForDraw: 1,
      pointsForLoss: 0
    }
  });

  // Check permissions
  const canCreateFixtures = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'captain' || user?.role === 'vicecaptain';
  
  useEffect(() => {
    if (!canCreateFixtures) {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [canCreateFixtures, router]);

  const fetchData = async () => {
    try {
      const [eventsRes, sportGamesRes, playersRes, teamsRes] = await Promise.all([
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/events`, { withCredentials: true }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sportgames`, { withCredentials: true }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users?role=player`, { withCredentials: true }),
        axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams`, { withCredentials: true })
      ]);
      
      setEvents(eventsRes.data.events);
      setSportGames(sportGamesRes.data.sportGames);
      setPlayers(playersRes.data.users || []);
      setTeams(teamsRes.data.teams || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };


  const handleEventChange = (eventId: string) => {
    setFormData({ ...formData, eventId, participants: [] });
  };

  const handleParticipantTypeChange = (participantType: string) => {
    setFormData({ ...formData, participantType, participants: [] });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures`,
        formData,
        { withCredentials: true }
      );

      if (response.data.success) {
        router.push(`/fixtures/${response.data.fixture._id}`);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create fixture');
      setLoading(false);
    }
  };

  if (!canCreateFixtures) {
    return null;
  }

  // Get available participants based on type and event
  const availableParticipants = formData.participantType === 'team' 
    ? teams.filter(team => {
        const teamEventId = typeof team.eventId === 'string' ? team.eventId : team.eventId._id;
        return teamEventId === formData.eventId;
      })
    : players;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <Link href="/fixtures" className="text-indigo-600 hover:text-indigo-900 mb-2 inline-block">
              ← Back to Fixtures
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Create Fixture</h1>
            <p className="text-gray-600 mt-1">Set up a new tournament fixture</p>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    required
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
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
                    onChange={(e) => handleParticipantTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    required
                  >
                    <option value="player">Players</option>
                    <option value="team">Teams</option>
                  </select>
                </div>
              </div>

              {/* Format-specific settings */}
              {formData.format === 'knockout' ? (
                <div className="mt-6 space-y-4">
                  <h3 className="text-sm font-medium text-gray-900">Knockout Settings</h3>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.settings.thirdPlaceMatch}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, thirdPlaceMatch: e.target.checked }
                      })}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Include 3rd place match</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.settings.randomizeSeeds}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, randomizeSeeds: e.target.checked }
                      })}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Randomize seeding</span>
                  </label>

                  {formData.participantType === 'player' && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.settings.avoidSameTeamFirstRound}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: { ...formData.settings, avoidSameTeamFirstRound: e.target.checked }
                        })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Avoid same team players in first round
                      </span>
                    </label>
                  )}
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <h3 className="text-sm font-medium text-gray-900">Round Robin Settings</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Rounds
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.settings.rounds}
                      onChange={(e) => setFormData({
                        ...formData,
                        settings: { ...formData.settings, rounds: parseInt(e.target.value) }
                      })}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>

                  {formData.participantType === 'team' && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.settings.homeAndAway}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: { ...formData.settings, homeAndAway: e.target.checked }
                        })}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Home and Away matches</span>
                    </label>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Points for Win
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.settings.pointsForWin}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: { ...formData.settings, pointsForWin: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Points for Draw
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.settings.pointsForDraw}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: { ...formData.settings, pointsForDraw: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Points for Loss
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.settings.pointsForLoss}
                        onChange={(e) => setFormData({
                          ...formData,
                          settings: { ...formData.settings, pointsForLoss: parseInt(e.target.value) }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Common settings */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Match Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.settings.matchDuration}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings, matchDuration: parseInt(e.target.value) }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Venue
                  </label>
                  <input
                    type="text"
                    value={formData.settings.venue}
                    onChange={(e) => setFormData({
                      ...formData,
                      settings: { ...formData.settings, venue: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
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
                  {formData.participantType === 'team' && ' Please create teams for this event first.'}
                </p>
              ) : (
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
                        {formData.participantType === 'player' && participant.email && (
                          <span className="text-gray-500 ml-2">({participant.email})</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              
              <p className="mt-2 text-sm text-gray-500">
                Minimum {formData.format === 'knockout' ? '2' : '2'} participants required
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3">
              <Link
                href="/fixtures"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || formData.participants.length < 2}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Fixture'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function CreateFixturePage() {
  return (
    <AuthGuard>
      <CreateFixtureContent />
    </AuthGuard>
  );
}