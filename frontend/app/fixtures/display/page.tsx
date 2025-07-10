'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import debounce from 'lodash/debounce';

interface Event {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface Fixture {
  _id: string;
  name: string;
  eventId: {
    _id: string;
    name: string;
  };
  sportGameId: {
    _id: string;
    title: string;
    type: string;
    category: string;
  };
  format: 'knockout' | 'roundrobin';
  participantType: 'player' | 'team';
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
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
  nextMatchId?: string;
  previousMatchIds?: string[];
  isThirdPlaceMatch?: boolean;
}

interface Participant {
  _id: string;
  name: string;
  email?: string;
  displayName?: string;
  teamLogo?: string;
  teamMemberships?: Array<{
    teamId: string | { _id: string; name: string };
    eventId: string;
    role: string;
  }>;
}

interface FixtureWithDetails extends Fixture {
  matches: Match[];
  participants: Participant[];
}

function FixtureDisplayContent() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [fixtures, setFixtures] = useState<FixtureWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [teamMaps, setTeamMaps] = useState<{ [fixtureId: string]: Map<string, string> }>({});

  // Fetch events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !selectedEventId) return;

    const interval = setInterval(() => {
      fetchFixtures(selectedEventId);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedEventId]);

  // Fetch fixtures when event is selected
  useEffect(() => {
    if (selectedEventId) {
      fetchFixtures(selectedEventId);
    }
  }, [selectedEventId]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/events`,
        { withCredentials: true }
      );
      
      // Filter active events
      const activeEvents = response.data.events.filter((event: Event) => event.isActive);
      setEvents(activeEvents);
      
      // Auto-select first event if available
      if (activeEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(activeEvents[0]._id);
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setError('Failed to fetch events');
      setLoading(false);
    }
  };

  const fetchTeamData = async (eventId: string, fixtures: FixtureWithDetails[]) => {
    try {
      // Get all player fixtures
      const playerFixtures = fixtures.filter(f => f.participantType === 'player');
      if (playerFixtures.length === 0) return;

      // Fetch teams for this event
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/teams?eventId=${eventId}`,
        { withCredentials: true }
      );
      
      // Create team maps for each fixture
      const newTeamMaps: { [fixtureId: string]: Map<string, string> } = {};
      
      playerFixtures.forEach(fixture => {
        const teamMap = new Map<string, string>();
        response.data.teams.forEach((team: any) => {
          teamMap.set(team._id, team.name);
        });
        newTeamMaps[fixture._id] = teamMap;
      });
      
      setTeamMaps(newTeamMaps);
    } catch (err) {
      console.error('Error fetching team data:', err);
    }
  };

  const fetchFixtures = async (eventId: string) => {
    try {
      // Fetch only knockout fixtures for the selected event
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/fixtures?eventId=${eventId}&format=knockout`,
        { withCredentials: true }
      );
      
      // For each fixture, fetch its details (matches and participants)
      const fixturesWithDetails = await Promise.all(
        response.data.fixtures.map(async (fixture: Fixture) => {
          try {
            const detailsResponse = await axios.get(
              `${process.env.NEXT_PUBLIC_API_URL}/fixtures/${fixture._id}`,
              { withCredentials: true }
            );
            
            return {
              ...fixture,
              matches: detailsResponse.data.matches || [],
              participants: detailsResponse.data.participants || []
            };
          } catch (err) {
            console.error(`Error fetching details for fixture ${fixture._id}:`, err);
            return {
              ...fixture,
              matches: [],
              participants: []
            };
          }
        })
      );
      
      setFixtures(fixturesWithDetails);
      
      // Fetch team data for player fixtures
      await fetchTeamData(eventId, fixturesWithDetails);
    } catch (err: any) {
      console.error('Error fetching fixtures:', err);
      setError('Failed to fetch fixtures');
    }
  };

  const getPlayerTeamName = (fixtureId: string, participant: any): string | null => {
    if (!participant || !teamMaps[fixtureId]) return null;
    
    const teamMap = teamMaps[fixtureId];
    const eventId = fixtures.find(f => f._id === fixtureId)?.eventId._id;
    
    if (!eventId || !participant.teamMemberships) return null;
    
    const membership = participant.teamMemberships.find((tm: any) => 
      tm.eventId === eventId || tm.eventId._id === eventId
    );
    
    if (membership && membership.teamId) {
      const teamId = typeof membership.teamId === 'string' ? membership.teamId : membership.teamId._id;
      return teamMap.get(teamId) || null;
    }
    
    return null;
  };

  const renderTournamentBracket = (fixture: FixtureWithDetails) => {
    const { matches, participants } = fixture;
    
    if (!matches || matches.length === 0) {
      return <div className="text-center text-gray-500 py-8">No matches scheduled</div>;
    }

    // Group matches by round
    const rounds = Math.max(...matches.map(m => m.round));
    const roundMatches: { [key: number]: Match[] } = {};
    
    for (let i = 1; i <= rounds; i++) {
      roundMatches[i] = matches.filter(m => m.round === i).sort((a, b) => a.matchNumber - b.matchNumber);
    }

    const matchHeight = fixture.participantType === 'player' ? 120 : 100;
    const matchWidth = 240;
    const roundGap = 80;
    const matchVerticalGap = 20;
    const totalHeight = Math.pow(2, rounds - 1) * (matchHeight + matchVerticalGap);

    // Calculate match positions
    const matchPositions: { [key: string]: number } = {};
    
    // Position final match
    if (roundMatches[rounds]) {
      roundMatches[rounds].forEach((match) => {
        matchPositions[match._id] = totalHeight / 2;
      });
    }
    
    // Position other rounds
    for (let round = rounds - 1; round >= 1; round--) {
      const currentRoundMatches = roundMatches[round] || [];
      const nextRoundMatches = roundMatches[round + 1] || [];
      
      currentRoundMatches.forEach((match, matchIndex) => {
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const nextMatch = nextRoundMatches[nextMatchIndex];
        
        if (nextMatch && matchPositions[nextMatch._id] !== undefined) {
          const siblingIndex = matchIndex % 2 === 0 ? matchIndex + 1 : matchIndex - 1;
          const siblingMatch = currentRoundMatches[siblingIndex];
          
          if (siblingMatch) {
            const isTopMatch = matchIndex % 2 === 0;
            const offset = (isTopMatch ? -1 : 1) * (matchHeight + matchVerticalGap) / 2;
            matchPositions[match._id] = matchPositions[nextMatch._id] + offset;
          } else {
            matchPositions[match._id] = matchPositions[nextMatch._id];
          }
        } else {
          const spacing = totalHeight / currentRoundMatches.length;
          matchPositions[match._id] = (matchIndex + 0.5) * spacing;
        }
      });
    }

    return (
      <div className="overflow-x-auto overflow-y-hidden pb-4">
        <div className="relative" style={{ minHeight: `${totalHeight + 60}px`, width: `${rounds * (matchWidth + roundGap)}px` }}>
          {Object.entries(roundMatches).map(([round, roundMatchList], roundIndex) => {
            const roundNumber = parseInt(round);
            
            return (
              <div key={round} className="absolute" style={{ left: `${roundIndex * (matchWidth + roundGap)}px` }}>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 text-center">
                  {roundNumber === rounds ? 'Final' : 
                   roundNumber === rounds - 1 && rounds > 1 ? 'Semi-Finals' :
                   roundNumber === rounds - 2 && rounds > 2 ? 'Quarter-Finals' :
                   `Round ${round}`}
                </h4>
                
                {roundMatchList.map((match, matchIndex) => {
                  const centerY = matchPositions[match._id] || 0;
                  const topPosition = centerY - matchHeight / 2;
                  const isFinalMatch = roundNumber === rounds;
                  const isChampion = isFinalMatch && match.status === 'completed' && match.winner;
                  
                  return (
                    <div key={match._id} className="absolute" style={{ top: `${topPosition + 30}px`, width: `${matchWidth}px` }}>
                      {/* Winner badge for final match */}
                      {isChampion && (
                        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 flex items-center space-x-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>
                          </svg>
                          <span>Champion</span>
                        </div>
                      )}
                      
                      {/* Connecting lines */}
                      {roundNumber < rounds && (
                        <>
                          {(() => {
                            const nextRoundMatches = roundMatches[roundNumber + 1] || [];
                            const nextMatchIndex = Math.floor(matchIndex / 2);
                            const nextMatch = nextRoundMatches[nextMatchIndex];
                            
                            if (!nextMatch) return null;
                            
                            const currentY = centerY;
                            const nextY = matchPositions[nextMatch._id];
                            
                            if (nextY === undefined) return null;
                            
                            const siblingIndex = matchIndex % 2 === 0 ? matchIndex + 1 : matchIndex - 1;
                            const siblingMatch = roundMatchList[siblingIndex];
                            
                            const elements = [];
                            
                            // Horizontal line from match
                            elements.push(
                              <div
                                key="h-line"
                                className="absolute"
                                style={{
                                  left: `${matchWidth}px`,
                                  top: `${matchHeight / 2 - 1}px`,
                                  width: `${roundGap / 2}px`,
                                  height: '2px',
                                  backgroundColor: match.winner ? '#10b981' : '#d1d5db',
                                }}
                              />
                            );
                            
                            if (siblingMatch) {
                              const siblingY = matchPositions[siblingMatch._id];
                              const topY = Math.min(currentY, siblingY);
                              const bottomY = Math.max(currentY, siblingY);
                              const midY = (topY + bottomY) / 2;
                              const isTopMatch = currentY < siblingY;
                              
                              if (isTopMatch) {
                                // Vertical line down
                                elements.push(
                                  <div
                                    key="v-line"
                                    className="absolute"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 1}px`,
                                      top: `${matchHeight / 2}px`,
                                      width: '2px',
                                      height: `${midY - currentY}px`,
                                      backgroundColor: match.winner ? '#10b981' : '#d1d5db',
                                    }}
                                  />
                                );
                                
                                // Horizontal line to next match
                                elements.push(
                                  <div
                                    key="h-line-2"
                                    className="absolute"
                                    style={{
                                      left: `${matchWidth + roundGap / 2}px`,
                                      top: `${matchHeight / 2 + (midY - currentY) - 1}px`,
                                      width: `${roundGap / 2}px`,
                                      height: '2px',
                                      backgroundColor: (match.winner || siblingMatch.winner) ? '#10b981' : '#d1d5db',
                                    }}
                                  />
                                );
                              } else {
                                // Vertical line up
                                elements.push(
                                  <div
                                    key="v-line"
                                    className="absolute"
                                    style={{
                                      left: `${matchWidth + roundGap / 2 - 1}px`,
                                      top: `${midY - currentY + matchHeight / 2}px`,
                                      width: '2px',
                                      height: `${currentY - midY}px`,
                                      backgroundColor: match.winner ? '#10b981' : '#d1d5db',
                                    }}
                                  />
                                );
                              }
                            }
                            
                            return <>{elements}</>;
                          })()}
                        </>
                      )}
                      
                      {/* Match card */}
                      <div
                        className={`relative bg-white border rounded-lg p-2 shadow-sm ${
                          isChampion ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-white' :
                          match.status === 'completed' ? 'border-green-300' : 'border-gray-300'
                        }`}
                        style={{ height: `${matchHeight}px` }}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs text-gray-600">M{match.matchNumber}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            match.status === 'completed' ? 'bg-green-100 text-green-800' :
                            match.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {match.status === 'walkover' ? 'Bye' : match.status}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className={`flex justify-between items-center px-1.5 py-1 rounded text-xs ${
                            match.winner && match.homeParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-300' 
                              : ''
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-gray-900 truncate">
                                {match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(fixture._id, match.homeParticipant) && (
                                <span className="text-xs text-gray-500 italic truncate">
                                  {getPlayerTeamName(fixture._id, match.homeParticipant)}
                                </span>
                              )}
                            </div>
                            {match.homeScore !== undefined && (
                              <span className="font-bold text-gray-900 ml-1">{match.homeScore}</span>
                            )}
                          </div>
                          
                          <div className="border-t border-gray-100"></div>
                          
                          <div className={`flex justify-between items-center px-1.5 py-1 rounded text-xs ${
                            match.winner && match.awayParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-300' 
                              : ''
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium text-gray-900 truncate">
                                {match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(fixture._id, match.awayParticipant) && (
                                <span className="text-xs text-gray-500 italic truncate">
                                  {getPlayerTeamName(fixture._id, match.awayParticipant)}
                                </span>
                              )}
                            </div>
                            {match.awayScore !== undefined && (
                              <span className="font-bold text-gray-900 ml-1">{match.awayScore}</span>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AuthGuard allowedRoles={['super_admin', 'admin', 'captain', 'vicecaptain', 'player']}>
          <Header />
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-500">Loading...</div>
          </div>
        </AuthGuard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthGuard allowedRoles={['super_admin', 'admin', 'captain', 'vicecaptain', 'player']}>
        <Header />
        
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Controls Bar */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">Tournament Display</h1>
                
                {/* Event Selector */}
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Select Event</option>
                  {events.map((event) => (
                    <option key={event._id} value={event._id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Auto Refresh Toggle */}
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Auto-refresh</span>
                </label>
                
                {/* Refresh Interval */}
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value={15}>15 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={300}>5 minutes</option>
                  </select>
                )}
                
                {/* Manual Refresh Button */}
                <button
                  onClick={() => selectedEventId && fetchFixtures(selectedEventId)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}
          
          {/* No Event Selected */}
          {!selectedEventId && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">Please select an event to display tournaments</p>
            </div>
          )}
          
          {/* Fixtures Grid */}
          {selectedEventId && fixtures.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">No knockout tournaments found for this event</p>
            </div>
          )}
          
          {selectedEventId && fixtures.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {fixtures.map((fixture) => (
                <div key={fixture._id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="border-b border-gray-200 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {fixture.sportGameId.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {fixture.name} - {fixture.participantType === 'player' ? 'Individual' : 'Team'} Tournament
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        fixture.status === 'completed' ? 'bg-green-100 text-green-800' :
                        fixture.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                        fixture.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {fixture.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    {renderTournamentBracket(fixture)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AuthGuard>
    </div>
  );
}

export default function FixtureDisplayPage() {
  return <FixtureDisplayContent />;
}