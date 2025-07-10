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
  captainId: string | { _id: string };
  viceCaptainId: string | { _id: string };
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

function CreateFixtureContent() {
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

  const fetchData = async (retryCount = 0) => {
    setDataLoading(true);
    setError(null); // Clear any previous errors
    try {
      // Fetch data sequentially with increased delays to avoid rate limiting
      const eventsRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/events`, { withCredentials: true });
      setEvents(eventsRes.data.events);
      
      // Increased delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const sportGamesRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/sportgames`, { withCredentials: true });
      setSportGames(sportGamesRes.data.sportGames);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const playersRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, { withCredentials: true });
      // Filter to exclude super_admin and admin on the frontend
      const allUsers = playersRes.data.users || [];
      setPlayers(allUsers.filter((user: Player) => 
        user.role !== 'super_admin' && 
        user.role !== 'admin'
      ));
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const teamsRes = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/teams`, { withCredentials: true });
      setTeams(teamsRes.data.teams || []);
      
      // Clear error on success
      setError(null);
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      if (error.response?.status === 429) {
        if (retryCount < 3) {
          // Exponential backoff: wait longer with each retry
          const waitTime = Math.pow(2, retryCount + 1) * 1000; // 2s, 4s, 8s
          console.log(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
          setError(`Rate limited. Retrying in ${waitTime/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return fetchData(retryCount + 1);
        } else {
          setError('Too many requests. Please refresh the page in a few moments.');
        }
      } else {
        setError(error.response?.data?.error || 'Failed to load data');
      }
    } finally {
      setDataLoading(false);
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
    : players.filter(player => 
        player.role !== 'super_admin' && 
        player.role !== 'admin'
      );

  // Helper function to get player's role in a team
  const getPlayerRoleInTeam = (playerId: string, teamId: string): string | null => {
    const team = teams.find(t => t._id === teamId);
    if (!team) return null;
    
    const captainId = typeof team.captainId === 'string' ? team.captainId : team.captainId._id;
    const viceCaptainId = typeof team.viceCaptainId === 'string' ? team.viceCaptainId : team.viceCaptainId._id;
    
    if (captainId === playerId) return 'C';
    if (viceCaptainId === playerId) return 'VC';
    return null;
  };

  // Organize players by teams for the selected event
  const getPlayersByTeam = (): Array<{ teamId: string; teamName: string; players: Player[] }> => {
    if (formData.participantType !== 'player' || !formData.eventId) return [];
    
    const teamMap: { [teamId: string]: { teamName: string; players: Player[] } } = {};
    const playersWithoutTeam: Player[] = [];
    
    // Get teams for this event and sort alphabetically
    const eventTeams = teams
      .filter(team => {
        const teamEventId = typeof team.eventId === 'string' ? team.eventId : team.eventId._id;
        return teamEventId === formData.eventId;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Initialize team map
    eventTeams.forEach(team => {
      teamMap[team._id] = { teamName: team.name, players: [] };
    });
    
    // Organize players by their teams
    const playerList = availableParticipants as Player[];
    playerList.forEach((player) => {
      let addedToTeam = false;
      
      if (player.teamMemberships) {
        for (const membership of player.teamMemberships) {
          const teamId = typeof membership.teamId === 'string' 
            ? membership.teamId 
            : membership.teamId._id;
          
          if (membership.eventId === formData.eventId && teamMap[teamId]) {
            teamMap[teamId].players.push(player);
            addedToTeam = true;
            break;
          }
        }
      }
      
      if (!addedToTeam) {
        playersWithoutTeam.push(player);
      }
    });
    
    // Create sorted array instead of returning object to maintain order
    const sortedTeams: Array<{ teamId: string; teamName: string; players: Player[] }> = [];
    
    // Add teams in alphabetical order (already sorted)
    eventTeams.forEach(team => {
      sortedTeams.push({
        teamId: team._id,
        teamName: teamMap[team._id].teamName,
        players: teamMap[team._id].players.sort((a, b) => 
          (a.name || a.displayName || '').localeCompare(b.name || b.displayName || '')
        )
      });
    });
    
    // Add players without teams at the end if any
    if (playersWithoutTeam.length > 0) {
      sortedTeams.push({
        teamId: 'no-team',
        teamName: 'Players without team',
        players: playersWithoutTeam.sort((a, b) => 
          (a.name || a.displayName || '').localeCompare(b.name || b.displayName || '')
        )
      });
    }
    
    return sortedTeams;
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {dataLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading fixture data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => fetchData()}
                      className="text-sm font-medium text-red-600 hover:text-red-500"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
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
              ) : formData.participantType === 'team' ? (
                // Team selection - existing layout
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
              ) : (
                // Player selection - organized by teams
                <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md p-4">
                  <div className={`grid gap-4 ${
                    getPlayersByTeam().length <= 2 
                      ? 'grid-cols-1 md:grid-cols-2' 
                      : getPlayersByTeam().length <= 3
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  }`}>
                    {getPlayersByTeam().map(({ teamId, teamName, players }) => {
                      const teamPlayerIds = players.map(p => p._id);
                      const selectedFromTeam = teamPlayerIds.filter(id => formData.participants.includes(id));
                      const isAllSelected = selectedFromTeam.length === teamPlayerIds.length && teamPlayerIds.length > 0;
                      
                      return (
                        <div key={teamId} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2 border-b border-gray-200 pb-1">
                            <h3 className="font-medium text-sm text-gray-900">
                              {teamName} ({selectedFromTeam.length}/{players.length})
                            </h3>
                            {players.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (isAllSelected) {
                                    // Deselect all from this team
                                    setFormData({
                                      ...formData,
                                      participants: formData.participants.filter(id => !teamPlayerIds.includes(id))
                                    });
                                  } else {
                                    // Select all from this team
                                    const newParticipants = [...formData.participants];
                                    teamPlayerIds.forEach(id => {
                                      if (!newParticipants.includes(id)) {
                                        newParticipants.push(id);
                                      }
                                    });
                                    setFormData({ ...formData, participants: newParticipants });
                                  }
                                }}
                                className="text-xs text-indigo-600 hover:text-indigo-500"
                              >
                                {isAllSelected ? 'Deselect all' : 'Select all'}
                              </button>
                            )}
                          </div>
                          <div className="space-y-1">
                            {players.map((player) => {
                              const role = getPlayerRoleInTeam(player._id, teamId);
                              return (
                                <label
                                  key={player._id}
                                  className="flex items-center hover:bg-white rounded px-2 py-1 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.participants.includes(player._id)}
                                    onChange={() => handleParticipantToggle(player._id)}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                                  />
                                  <span className="ml-2 text-sm text-gray-700 truncate flex items-center gap-1" title={player.name || player.displayName}>
                                    {player.name || player.displayName}
                                    {role && (
                                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                        role === 'C' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                                      }`}>
                                        {role}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Minimum {formData.format === 'knockout' ? '2' : '2'} participants required
                </p>
                {formData.participantType === 'player' && formData.participants.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, participants: [] })}
                    className="text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    Clear selection
                  </button>
                )}
              </div>
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
          </>
          )}
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