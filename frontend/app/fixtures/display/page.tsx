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
  const [selectedFixtureIndex, setSelectedFixtureIndex] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [autoCycleInterval, setAutoCycleInterval] = useState<number>(0); // 0 means off
  const [teamMaps, setTeamMaps] = useState<{ [fixtureId: string]: Map<string, string> }>({});

  // Fetch events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  // Create a stable callback for fetching fixtures
  const fetchFixturesCallback = useCallback(() => {
    if (selectedEventId) {
      fetchFixtures(selectedEventId);
    }
  }, [selectedEventId]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh || !selectedEventId) return;

    const interval = setInterval(() => {
      fetchFixturesCallback();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, selectedEventId, fetchFixturesCallback]);

  // Auto-cycle fixtures functionality
  useEffect(() => {
    if (autoCycleInterval === 0 || fixtures.length <= 1) return;

    const interval = setInterval(() => {
      setSelectedFixtureIndex((prev) => (prev + 1) % fixtures.length);
    }, autoCycleInterval * 1000);

    return () => clearInterval(interval);
  }, [autoCycleInterval, fixtures.length]);

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
      
      // Reset selected fixture index if it's out of bounds
      if (selectedFixtureIndex >= fixturesWithDetails.length) {
        setSelectedFixtureIndex(0);
      }
      
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
      return (
        <div className="bg-gray-100 rounded-md p-6 text-center border border-gray-400">
          <svg className="mx-auto h-10 w-10 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-bold text-gray-900">No matches scheduled</p>
        </div>
      );
    }

    // Group matches by round
    const rounds = Math.max(...matches.map(m => m.round));
    const roundMatches: { [key: number]: Match[] } = {};
    
    for (let i = 1; i <= rounds; i++) {
      roundMatches[i] = matches.filter(m => m.round === i).sort((a, b) => a.matchNumber - b.matchNumber);
    }

    const matchHeight = fixture.participantType === 'player' ? 90 : 75;
    const matchWidth = 200;
    const roundGap = 80;
    const matchVerticalGap = 15;
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
      <div className="overflow-x-auto overflow-y-hidden pb-2">
        <div className="relative" style={{ minHeight: `${totalHeight + 40}px`, width: `${rounds * (matchWidth + roundGap)}px` }}>
          {Object.entries(roundMatches).map(([round, roundMatchList], roundIndex) => {
            const roundNumber = parseInt(round);
            
            return (
              <div key={round} className="absolute" style={{ left: `${roundIndex * (matchWidth + roundGap)}px` }}>
                <h4 className="text-xs font-bold text-gray-800 mb-1 text-center">
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
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>
                          </svg>
                          <span>WINNER</span>
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
                                  backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                }}
                              />
                            );
                            
                            // Connection dot at start
                            elements.push(
                              <div
                                key="dot-start"
                                className="absolute"
                                style={{
                                  left: `${matchWidth - 2}px`,
                                  top: `${matchHeight / 2 - 3}px`,
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                  border: '1px solid white',
                                  zIndex: 1
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
                                      backgroundColor: match.winner ? '#10b981' : '#9ca3af',
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
                                      backgroundColor: (match.winner || siblingMatch.winner) ? '#10b981' : '#9ca3af',
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
                                      backgroundColor: match.winner ? '#10b981' : '#9ca3af',
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
                        className={`relative bg-white border rounded-md p-1.5 shadow-sm ${
                          isChampion ? 'border-2 border-yellow-500 bg-gradient-to-br from-yellow-50 to-white shadow-yellow-200' :
                          match.status === 'completed' ? 'border-green-600' : 'border-gray-400'
                        }`}
                        style={{ height: `${matchHeight}px`, width: `${matchWidth}px` }}
                      >
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[10px] font-bold text-gray-700">M{match.matchNumber}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            match.status === 'completed' ? 'bg-green-200 text-green-900' :
                            match.status === 'in_progress' ? 'bg-yellow-200 text-yellow-900' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            {match.status === 'walkover' ? 'Bye' : match.status === 'completed' ? 'Done' : match.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div className="space-y-1">
                          <div className={`flex justify-between items-center px-1.5 py-1 rounded transition-all ${
                            match.winner && match.homeParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-500' 
                              : 'bg-gray-50 border border-gray-300'
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0 mr-1">
                              <span className="font-semibold text-xs text-gray-900 truncate leading-tight">
                                {match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(fixture._id, match.homeParticipant) && (
                                <span className="text-[10px] text-gray-600 truncate leading-tight">
                                  {getPlayerTeamName(fixture._id, match.homeParticipant)}
                                </span>
                              )}
                            </div>
                            {match.homeScore !== undefined && (
                              <span className="font-bold text-sm text-gray-900 flex-shrink-0">{match.homeScore}</span>
                            )}
                          </div>
                          
                          <div className="border-t border-gray-300"></div>
                          
                          <div className={`flex justify-between items-center px-1.5 py-1 rounded transition-all ${
                            match.winner && match.awayParticipant?._id === match.winner._id 
                              ? 'bg-green-100 border border-green-500' 
                              : 'bg-gray-50 border border-gray-300'
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0 mr-1">
                              <span className="font-semibold text-xs text-gray-900 truncate leading-tight">
                                {match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(fixture._id, match.awayParticipant) && (
                                <span className="text-[10px] text-gray-600 truncate leading-tight">
                                  {getPlayerTeamName(fixture._id, match.awayParticipant)}
                                </span>
                              )}
                            </div>
                            {match.awayScore !== undefined && (
                              <span className="font-bold text-sm text-gray-900 flex-shrink-0">{match.awayScore}</span>
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
            <div className="bg-white rounded-xl shadow-2xl p-12 border-2 border-gray-300">
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mb-4"></div>
                <p className="text-xl font-semibold text-gray-700">Loading Tournament Display...</p>
              </div>
            </div>
          </div>
        </AuthGuard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthGuard allowedRoles={['super_admin', 'admin', 'captain', 'vicecaptain', 'player']}>
        <Header />
        
        <div className="max-w-full mx-auto px-2 py-2">
          {/* Compact Controls Bar */}
          <div className="bg-white rounded-lg shadow-md p-3 mb-3 border border-gray-300">
            <div className="flex flex-wrap items-center gap-4">
              {/* Event Selection */}
              <div className="flex-1 min-w-[200px]">
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="block w-full px-3 py-2 text-base font-semibold text-gray-900 rounded-md border-2 border-gray-400 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600 bg-white"
                >
                  <option value="" className="text-gray-600">-- Select Event --</option>
                  {events.map((event) => (
                    <option key={event._id} value={event._id} className="text-gray-900 font-medium">
                      {event.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Refresh Controls */}
              <div className="flex items-center gap-3">
                {/* Auto Refresh Toggle */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-400 text-indigo-600 focus:ring-2 focus:ring-indigo-600"
                  />
                  <span className="ml-2 text-sm font-bold text-gray-900">Auto-refresh</span>
                </label>
                
                {/* Refresh Interval */}
                {autoRefresh && (
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="px-2 py-1.5 text-sm font-semibold text-gray-900 rounded-md border-2 border-gray-400 bg-white"
                      >
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={60}>1m</option>
                    <option value={120}>2m</option>
                    <option value={300}>5m</option>
                  </select>
                )}
                
                {/* Manual Refresh Button */}
                <button
                  onClick={fetchFixturesCallback}
                  disabled={!selectedEventId}
                  className="px-3 py-1.5 border-2 border-indigo-600 text-sm font-bold rounded-md text-indigo-700 bg-white hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-500 rounded-md p-3 mb-3 flex items-center">
              <svg className="w-5 h-5 text-red-700 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-bold text-red-900">{error}</p>
            </div>
          )}
          
          {/* No Event Selected */}
          {!selectedEventId && (
            <div className="bg-gray-100 rounded-lg p-8 text-center border border-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-base font-bold text-gray-900">No Event Selected</p>
              <p className="mt-1 text-sm font-medium text-gray-700">Please select an event from the dropdown above</p>
            </div>
          )}
          
          {/* Fixtures Grid */}
          {selectedEventId && fixtures.length === 0 && (
            <div className="bg-yellow-50 rounded-lg p-8 text-center border border-yellow-500">
              <svg className="mx-auto h-12 w-12 text-yellow-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-base font-bold text-gray-900">No Tournaments Found</p>
              <p className="mt-1 text-sm font-medium text-gray-700">No knockout tournaments available for this event</p>
            </div>
          )}
          
          {selectedEventId && fixtures.length > 0 && (
            <div>
              {/* Compact Fixture Navigation */}
              <div className="bg-white rounded-lg shadow-md p-3 mb-3 border border-gray-300">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Previous/Next Navigation */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedFixtureIndex(Math.max(0, selectedFixtureIndex - 1))}
                      disabled={selectedFixtureIndex === 0}
                      className="p-2 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    
                    <span className="text-sm font-bold text-gray-900">
                      {selectedFixtureIndex + 1}/{fixtures.length}
                    </span>
                    
                    <button
                      onClick={() => setSelectedFixtureIndex(Math.min(fixtures.length - 1, selectedFixtureIndex + 1))}
                      disabled={selectedFixtureIndex === fixtures.length - 1}
                      className="p-2 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Fixture Selector */}
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={selectedFixtureIndex}
                      onChange={(e) => setSelectedFixtureIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm font-semibold text-gray-900 rounded-md border-2 border-gray-400 bg-white"
                    >
                      {fixtures.map((fixture, index) => (
                        <option key={fixture._id} value={index} className="text-gray-900">
                          {fixture.sportGameId.title} - {fixture.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Auto-cycle Control */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-bold text-gray-900">Auto-cycle:</label>
                    <select
                      value={autoCycleInterval}
                      className="px-2 py-1.5 text-sm font-semibold text-gray-900 rounded-md border-2 border-gray-400 bg-white"
                      onChange={(e) => setAutoCycleInterval(Number(e.target.value))}
                    >
                      <option value={0}>Off</option>
                      <option value={30}>30s</option>
                      <option value={60}>1m</option>
                      <option value={120}>2m</option>
                    </select>
                    {autoCycleInterval > 0 && (
                      <span className="text-green-700 font-bold text-sm">✓</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Single Fixture Display */}
              {fixtures[selectedFixtureIndex] && (
                <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-400">
                  <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-2xl font-black text-white">
                          {fixtures[selectedFixtureIndex].sportGameId.title}
                        </h3>
                        <p className="text-base font-semibold text-indigo-100 mt-1">
                          {fixtures[selectedFixtureIndex].name} - {fixtures[selectedFixtureIndex].participantType === 'player' ? 'Individual' : 'Team'} Tournament
                        </p>
                      </div>
                      <span className={`px-4 py-2 text-sm font-black rounded-full shadow-md ${
                        fixtures[selectedFixtureIndex].status === 'completed' ? 'bg-green-600 text-white' :
                        fixtures[selectedFixtureIndex].status === 'in_progress' ? 'bg-yellow-600 text-white' :
                        fixtures[selectedFixtureIndex].status === 'scheduled' ? 'bg-blue-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {fixtures[selectedFixtureIndex].status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50">
                    {renderTournamentBracket(fixtures[selectedFixtureIndex])}
                  </div>
                </div>
              )}
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