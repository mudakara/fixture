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

interface Fixture {
  _id: string;
  name: string;
  description?: string;
  eventId: {
    _id: string;
    name: string;
    startDate: string;
    endDate: string;
  };
  sportGameId: {
    _id: string;
    title: string;
    type: string;
    category: string;
  };
  format: 'knockout' | 'roundrobin';
  participantType: 'player' | 'team';
  participants: string[];
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  startDate: string;
  endDate?: string;
  settings: any;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
}

interface Match {
  _id: string;
  fixtureId: string;
  round: number;
  matchNumber: number;
  homeParticipant?: any;
  awayParticipant?: any;
  homeScore?: number;
  awayScore?: number;
  winner?: any;
  status: string;
  scheduledDate?: string;
  actualDate?: string;
  notes?: string;
}

interface Participant {
  _id: string;
  name: string;
  email?: string;
  displayName?: string;
  teamLogo?: string;
}

function FixtureDetailContent({ params }: { params: Promise<Params> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [fixture, setFixture] = useState<Fixture | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [teamMap, setTeamMap] = useState<Map<string, string>>(new Map());
  const [updateForm, setUpdateForm] = useState({
    homeScore: 0,
    awayScore: 0,
    status: 'scheduled',
    notes: ''
  });

  const canManageFixtures = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'captain' || user?.role === 'vicecaptain';
  const isSuperAdmin = user?.role === 'super_admin';
  
  // Check if any matches have been played
  const hasPlayedMatches = matches.some(m => m.status === 'completed' || m.status === 'in_progress');

  useEffect(() => {
    fetchFixtureDetails();
  }, [resolvedParams.id]);

  const fetchTeamData = async (eventId: string, matches: Match[]) => {
    try {
      // Get all unique team IDs from player team memberships
      const teamIds = new Set<string>();
      
      matches.forEach(match => {
        ['homeParticipant', 'awayParticipant', 'winner'].forEach(field => {
          const participant = (match as any)[field];
          if (participant && participant.teamMemberships) {
            participant.teamMemberships.forEach((tm: any) => {
              if (tm.eventId === eventId && tm.teamId) {
                teamIds.add(tm.teamId);
              }
            });
          }
        });
      });
      
      // Fetch teams for this event
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/teams?eventId=${eventId}`,
        { withCredentials: true }
      );
      
      // Create a map of teamId to team name
      const newTeamMap = new Map<string, string>();
      response.data.teams.forEach((team: any) => {
        newTeamMap.set(team._id, team.name);
      });
      
      setTeamMap(newTeamMap);
      console.log('Team map created:', Object.fromEntries(newTeamMap));
    } catch (err) {
      console.error('Error fetching team data:', err);
    }
  };

  const fetchFixtureDetails = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${resolvedParams.id}`,
        { withCredentials: true }
      );
      
      setFixture(response.data.fixture);
      setMatches(response.data.matches || []);
      setParticipants(response.data.participants || []);
      
      // If it's a player fixture, fetch team data
      if (response.data.fixture.participantType === 'player' && response.data.fixture.eventId) {
        await fetchTeamData(response.data.fixture.eventId._id, response.data.matches);
      }
      
      // Debug: Log first match with player data
      if (response.data.matches && response.data.matches.length > 0) {
        const firstMatch = response.data.matches[0];
        console.log('First match participant data:', {
          homeParticipant: firstMatch.homeParticipant,
          awayParticipant: firstMatch.awayParticipant
        });
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching fixture details:', err);
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Failed to fetch fixture details';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: { [key: string]: string } = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      postponed: 'bg-gray-100 text-gray-800',
      walkover: 'bg-purple-100 text-purple-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleMatchClick = (match: Match) => {
    if (canManageFixtures && match.status !== 'walkover') {
      setSelectedMatch(match);
      setUpdateForm({
        homeScore: match.homeScore || 0,
        awayScore: match.awayScore || 0,
        status: match.status,
        notes: match.notes || ''
      });
      setShowUpdateModal(true);
    }
  };

  const handleUpdateMatch = async () => {
    if (!selectedMatch) return;

    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture?._id}/matches/${selectedMatch._id}`,
        updateForm,
        { withCredentials: true }
      );
      
      setShowUpdateModal(false);
      fetchFixtureDetails(); // Refresh data
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update match');
    }
  };

  const handleRandomize = async () => {
    if (!fixture) return;
    
    const confirmMessage = 'Are you sure you want to randomize the bracket? This will regenerate all matches with new random pairings.';
    if (!confirm(confirmMessage)) return;

    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture._id}/randomize`,
        {},
        { withCredentials: true }
      );
      
      if (response.data.success) {
        alert('Bracket randomized successfully!');
        fetchFixtureDetails(); // Refresh data
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to randomize bracket');
    }
  };

  // Helper function to get team name for a player
  const getPlayerTeamName = (participant: any) => {
    if (!participant || !participant.teamMemberships || fixture?.participantType !== 'player') {
      return null;
    }
    
    // Find the team membership for this event
    const membership = participant.teamMemberships.find((tm: any) => 
      tm.eventId === fixture.eventId._id
    );
    
    if (membership && membership.teamId) {
      // Look up team name from our teamMap
      return teamMap.get(membership.teamId) || null;
    }
    
    return null;
  };

  const renderKnockoutBracket = () => {
    const rounds = Math.max(...matches.map(m => m.round));
    const roundMatches: { [key: number]: Match[] } = {};
    
    for (let i = 1; i <= rounds; i++) {
      roundMatches[i] = matches.filter(m => m.round === i).sort((a, b) => a.matchNumber - b.matchNumber);
    }

    const matchHeight = fixture?.participantType === 'player' ? 150 : 125;
    const matchWidth = 300;
    const roundGap = 120;
    const matchVerticalGap = 30;

    // Calculate total height needed
    const totalHeight = Math.pow(2, rounds - 1) * (matchHeight + matchVerticalGap);

    return (
      <div className="overflow-x-auto pb-8">
        <div className="relative" style={{ minHeight: `${totalHeight + 100}px` }}>
          {Object.entries(roundMatches).map(([round, roundMatchList], roundIndex) => {
            const roundNumber = parseInt(round);
            const matchesInThisRound = roundMatchList.length;
            const verticalSpacing = totalHeight / matchesInThisRound;
            
            return (
              <div key={round} className="absolute" style={{ left: `${roundIndex * (matchWidth + roundGap)}px` }}>
                <h3 className="text-base font-semibold text-gray-900 mb-4 text-center">
                  {roundNumber === rounds ? 'Final' : 
                   roundNumber === rounds - 1 && rounds > 1 ? 'Semi-Finals' :
                   roundNumber === rounds - 2 && rounds > 2 ? 'Quarter-Finals' :
                   `Round ${round}`}
                </h3>
                
                {roundMatchList.map((match, matchIndex) => {
                  const centerY = (matchIndex + 0.5) * verticalSpacing;
                  const topPosition = centerY - matchHeight / 2;
                  
                  const isFinalMatch = roundNumber === rounds;
                  const isChampion = isFinalMatch && match.status === 'completed' && match.winner;
                  
                  return (
                    <div key={match._id} className="absolute" style={{ top: `${topPosition + 40}px`, width: `${matchWidth}px` }}>
                      {/* Winner badge for final match */}
                      {isChampion && (
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>
                          </svg>
                          <span>Champion</span>
                        </div>
                      )}
                      {/* Connecting lines for non-final rounds */}
                      {roundNumber < rounds && (
                        <>
                          {/* Horizontal line from match center */}
                          <div
                            className="absolute"
                            style={{
                              left: `${matchWidth}px`,
                              top: `${matchHeight / 2}px`,
                              width: `${roundGap / 2}px`,
                              height: '2px',
                              backgroundColor: match.winner ? '#10b981' : '#d1d5db'
                            }}
                          />
                          
                          {/* Connection dot at match edge */}
                          <div
                            className="absolute"
                            style={{
                              left: `${matchWidth - 4}px`,
                              top: `${matchHeight / 2 - 4}px`,
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: match.winner ? '#10b981' : '#6b7280',
                              zIndex: 10
                            }}
                          />
                          
                          {/* For pairs of matches, draw vertical connector */}
                          {matchIndex % 2 === 0 && matchIndex < matchesInThisRound - 1 && (
                            <>
                              {/* Vertical line connecting two matches */}
                              <div
                                className="absolute"
                                style={{
                                  left: `${matchWidth + roundGap / 2}px`,
                                  top: `${matchHeight / 2}px`,
                                  width: '2px',
                                  height: `${verticalSpacing}px`,
                                  backgroundColor: '#d1d5db'
                                }}
                              />
                              
                              {/* Horizontal line to next round */}
                              <div
                                className="absolute"
                                style={{
                                  left: `${matchWidth + roundGap / 2}px`,
                                  top: `${matchHeight / 2 + verticalSpacing / 2}px`,
                                  width: `${roundGap / 2}px`,
                                  height: '2px',
                                  backgroundColor: '#d1d5db'
                                }}
                              />
                            </>
                          )}
                          
                          {/* For single advancing matches (like when there's a bye) */}
                          {matchesInThisRound === 1 && (
                            <div
                              className="absolute"
                              style={{
                                left: `${matchWidth + roundGap / 2}px`,
                                top: `${matchHeight / 2}px`,
                                width: `${roundGap / 2}px`,
                                height: '2px',
                                backgroundColor: '#d1d5db'
                              }}
                            />
                          )}
                        </>
                      )}
                      {/* Match card */}
                      <div
                        onClick={() => handleMatchClick(match)}
                        className={`relative bg-white border-2 rounded-lg p-3 shadow-sm transition-all ${
                          canManageFixtures && match.status !== 'walkover' 
                            ? 'cursor-pointer hover:shadow-lg hover:border-indigo-300' 
                            : ''
                        } ${
                          isChampion ? 'border-yellow-400 bg-yellow-50 shadow-lg' :
                          match.status === 'completed' ? 'border-green-200' : 'border-gray-200'
                        }`}
                        style={{ height: `${matchHeight}px`, zIndex: 5 }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-gray-600">Match {match.matchNumber}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(match.status)}`}>
                            {match.status === 'walkover' ? 'Bye' : match.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className={`flex justify-between items-center px-2 py-1 rounded ${
                            match.winner && match.homeParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-300' 
                              : 'hover:bg-gray-50'
                          }`}>
                            <div className="flex flex-col truncate max-w-[200px]">
                              <span className="text-sm font-medium text-gray-900" title={match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}>
                                {match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(match.homeParticipant) && (
                                <span className="text-xs text-gray-500 italic">{getPlayerTeamName(match.homeParticipant)}</span>
                              )}
                            </div>
                            {match.homeScore !== undefined && (
                              <span className="text-sm font-bold text-gray-900 ml-2">{match.homeScore}</span>
                            )}
                          </div>
                          
                          <div className="border-t border-gray-100"></div>
                          
                          <div className={`flex justify-between items-center px-2 py-1 rounded ${
                            match.winner && match.awayParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-300' 
                              : 'hover:bg-gray-50'
                          }`}>
                            <div className="flex flex-col truncate max-w-[200px]">
                              <span className="text-sm font-medium text-gray-900" title={match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}>
                                {match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(match.awayParticipant) && (
                                <span className="text-xs text-gray-500 italic">{getPlayerTeamName(match.awayParticipant)}</span>
                              )}
                            </div>
                            {match.awayScore !== undefined && (
                              <span className="text-sm font-bold text-gray-900 ml-2">{match.awayScore}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRoundRobinMatches = () => {
    const rounds = Math.max(...matches.map(m => m.round));
    
    return (
      <div className="space-y-6">
        {Array.from({ length: rounds }, (_, i) => i + 1).map(round => (
          <div key={round}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Round {round}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {matches
                .filter(m => m.round === round)
                .map((match) => (
                  <div
                    key={match._id}
                    onClick={() => handleMatchClick(match)}
                    className={`bg-white border rounded-lg p-4 ${
                      canManageFixtures ? 'cursor-pointer hover:shadow-md' : ''
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-700">Match {match.matchNumber}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusBadgeColor(match.status)}`}>
                        {match.status}
                      </span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {match.homeParticipant?.name || match.homeParticipant?.displayName}
                        </span>
                        {match.homeScore !== undefined && (
                          <span className="text-lg font-bold text-gray-900">{match.homeScore}</span>
                        )}
                      </div>
                      
                      <div className="text-center text-sm font-medium text-gray-600">vs</div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-gray-900">
                          {match.awayParticipant?.name || match.awayParticipant?.displayName}
                        </span>
                        {match.awayScore !== undefined && (
                          <span className="text-lg font-bold text-gray-900">{match.awayScore}</span>
                        )}
                      </div>
                    </div>
                    
                    {match.scheduledDate && (
                      <p className="text-sm text-gray-700 mt-3">
                        {formatDate(match.scheduledDate)}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!fixture) return <div>Fixture not found</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="mb-6">
            <Link href="/fixtures" className="text-indigo-600 hover:text-indigo-900 mb-2 inline-block">
              ← Back to Fixtures
            </Link>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{fixture.name}</h1>
                {fixture.description && (
                  <p className="text-gray-600 mt-1">{fixture.description}</p>
                )}
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  fixture.format === 'knockout' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                }`}>
                  {fixture.format === 'knockout' ? 'Knockout' : 'Round Robin'}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  fixture.status === 'completed' ? 'bg-green-100 text-green-800' :
                  fixture.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                  fixture.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {fixture.status.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Fixture Info */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Fixture Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Event</p>
                <p className="font-medium text-gray-900">{fixture.eventId.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Sport/Game</p>
                <p className="font-medium text-gray-900">{fixture.sportGameId.title} ({fixture.sportGameId.type})</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Participants</p>
                <p className="font-medium text-gray-900">{participants?.length || 0} {fixture.participantType === 'team' ? 'Teams' : 'Players'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Start Date</p>
                <p className="font-medium text-gray-900">{formatDate(fixture.startDate)}</p>
              </div>
              {fixture.endDate && (
                <div>
                  <p className="text-sm font-medium text-gray-700">End Date</p>
                  <p className="font-medium text-gray-900">{formatDate(fixture.endDate)}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-700">Created By</p>
                <p className="font-medium text-gray-900">{fixture.createdBy.name}</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Participants</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {participants?.map((participant) => (
                <div key={participant._id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-900 font-medium">{participant.name || participant.displayName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Matches/Bracket */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                {fixture.format === 'knockout' ? 'Tournament Bracket' : 'Matches'}
              </h2>
              <div className="flex items-center space-x-4">
                {/* Randomize button for super admin on knockout fixtures with teams */}
                {isSuperAdmin && fixture.format === 'knockout' && fixture.participantType === 'team' && !hasPlayedMatches && (
                  <button
                    onClick={handleRandomize}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Randomize Bracket</span>
                  </button>
                )}
                {fixture.format === 'knockout' && (
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-green-100 border border-green-300 rounded mr-1"></div>
                      <span className="text-gray-600">Winner</span>
                    </div>
                    <div className="flex items-center">
                      <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded mr-1"></div>
                      <span className="text-gray-600">Pending</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-4 h-4 mr-1">
                        <line x1="0" y1="8" x2="16" y2="8" stroke="#10b981" strokeWidth="2" />
                      </svg>
                      <span className="text-gray-600">Winner Path</span>
                    </div>
                  </div>
                )}
                {fixture.format === 'roundrobin' && (
                  <Link
                    href={`/fixtures/${fixture._id}/standings`}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    View Standings →
                  </Link>
                )}
              </div>
            </div>
            
            {fixture.format === 'knockout' ? (
              <div className="relative">
                <div className="absolute top-0 right-0 text-xs text-gray-500 bg-gray-50 px-3 py-1 rounded">
                  Scroll horizontally to view all rounds →
                </div>
                {renderKnockoutBracket()}
              </div>
            ) : renderRoundRobinMatches()}
          </div>
        </div>
      </div>

      {/* Update Match Modal */}
      {showUpdateModal && selectedMatch && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Update Match</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Status</label>
                <select
                  value={updateForm.status}
                  onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="postponed">Postponed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    {selectedMatch.homeParticipant?.name || 'Home'} Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={updateForm.homeScore}
                    onChange={(e) => setUpdateForm({ ...updateForm, homeScore: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1">
                    {selectedMatch.awayParticipant?.name || 'Away'} Score
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={updateForm.awayScore}
                    onChange={(e) => setUpdateForm({ ...updateForm, awayScore: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1">Notes</label>
                <textarea
                  value={updateForm.notes}
                  onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowUpdateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateMatch}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Update Match
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FixtureDetailPage({ params }: { params: Promise<Params> }) {
  return (
    <AuthGuard>
      <FixtureDetailContent params={params} />
    </AuthGuard>
  );
}