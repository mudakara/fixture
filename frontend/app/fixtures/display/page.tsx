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
        <div className="bg-gray-100 rounded-lg p-8 text-center">
          <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xl font-semibold text-gray-600">No matches scheduled</p>
        </div>
      );
    }

    // Group matches by round
    const rounds = Math.max(...matches.map(m => m.round));
    const roundMatches: { [key: number]: Match[] } = {};
    
    for (let i = 1; i <= rounds; i++) {
      roundMatches[i] = matches.filter(m => m.round === i).sort((a, b) => a.matchNumber - b.matchNumber);
    }

    const matchHeight = fixture.participantType === 'player' ? 180 : 160;
    const matchWidth = 340;
    const roundGap = 140;
    const matchVerticalGap = 40;
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
        <div className="relative" style={{ minHeight: `${totalHeight + 80}px`, width: `${rounds * (matchWidth + roundGap)}px` }}>
          {Object.entries(roundMatches).map(([round, roundMatchList], roundIndex) => {
            const roundNumber = parseInt(round);
            
            return (
              <div key={round} className="absolute" style={{ left: `${roundIndex * (matchWidth + roundGap)}px` }}>
                <h4 className="text-lg font-bold text-gray-800 mb-3 text-center bg-white px-4 py-2 rounded-lg shadow-sm inline-block w-full">
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
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 flex items-center space-x-2 bg-gradient-to-r from-yellow-400 to-amber-400 text-white px-4 py-2 rounded-full text-base font-black shadow-lg">
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z"/>
                          </svg>
                          <span>CHAMPION</span>
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
                                  height: '3px',
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
                                  left: `${matchWidth - 3}px`,
                                  top: `${matchHeight / 2 - 4}px`,
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: match.winner ? '#10b981' : '#9ca3af',
                                  border: '2px solid white',
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
                                      width: '3px',
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
                                      height: '3px',
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
                                      width: '3px',
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
                        className={`relative bg-white border-3 rounded-xl p-4 shadow-xl ${
                          isChampion ? 'border-4 border-yellow-500 bg-gradient-to-br from-yellow-100 via-yellow-50 to-white shadow-yellow-200' :
                          match.status === 'completed' ? 'border-green-500 shadow-green-200' : 'border-gray-400 shadow-gray-300'
                        }`}
                        style={{ height: `${matchHeight}px` }}
                      >
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-base font-bold text-gray-700">M{match.matchNumber}</span>
                          <span className={`text-base px-3 py-1.5 rounded-full font-bold shadow-sm ${
                            match.status === 'completed' ? 'bg-green-200 text-green-900' :
                            match.status === 'in_progress' ? 'bg-yellow-200 text-yellow-900' :
                            'bg-gray-200 text-gray-800'
                          }`}>
                            {match.status === 'walkover' ? 'Bye' : match.status}
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className={`flex justify-between items-center px-3 py-2.5 rounded-lg transition-all ${
                            match.winner && match.homeParticipant?._id === match.winner._id 
                              ? 'bg-green-200 border-2 border-green-400 shadow-sm' 
                              : 'bg-gray-50 border border-gray-300'
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-bold text-lg text-gray-900 truncate">
                                {match.homeParticipant?.name || match.homeParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(fixture._id, match.homeParticipant) && (
                                <span className="text-base text-gray-700 italic truncate">
                                  {getPlayerTeamName(fixture._id, match.homeParticipant)}
                                </span>
                              )}
                            </div>
                            {match.homeScore !== undefined && (
                              <span className="font-black text-2xl text-gray-900 ml-3">{match.homeScore}</span>
                            )}
                          </div>
                          
                          <div className="border-t-2 border-gray-300 my-1"></div>
                          
                          <div className={`flex justify-between items-center px-3 py-2.5 rounded-lg transition-all ${
                            match.winner && match.awayParticipant?._id === match.winner._id 
                              ? 'bg-green-200 border-2 border-green-400 shadow-sm' 
                              : 'bg-gray-50 border border-gray-300'
                          }`}>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-bold text-lg text-gray-900 truncate">
                                {match.awayParticipant?.name || match.awayParticipant?.displayName || 'TBD'}
                              </span>
                              {fixture.participantType === 'player' && getPlayerTeamName(fixture._id, match.awayParticipant) && (
                                <span className="text-base text-gray-700 italic truncate">
                                  {getPlayerTeamName(fixture._id, match.awayParticipant)}
                                </span>
                              )}
                            </div>
                            {match.awayScore !== undefined && (
                              <span className="font-black text-2xl text-gray-900 ml-3">{match.awayScore}</span>
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
        
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Controls Bar */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl shadow-lg p-6 mb-6 border border-indigo-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Section - Event Selection */}
              <div className="space-y-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Tournament Display</h1>
                
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Select Event
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="block w-full px-4 py-3 text-lg rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">-- Choose an Event --</option>
                    {events.map((event) => (
                      <option key={event._id} value={event._id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Right Section - Refresh Controls */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Refresh Settings</h2>
                
                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 space-y-4">
                  {/* Auto Refresh Toggle */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-lg font-medium text-gray-700">Auto-refresh data</span>
                    </label>
                    
                    {/* Manual Refresh Button */}
                    <button
                      onClick={fetchFixturesCallback}
                      disabled={!selectedEventId}
                      className="inline-flex items-center px-4 py-2.5 border-2 border-indigo-600 shadow-sm text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Refresh Now
                    </button>
                  </div>
                  
                  {/* Refresh Interval */}
                  {autoRefresh && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Refresh Interval
                      </label>
                      <select
                        value={refreshInterval}
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                        className="block w-full px-4 py-2.5 text-base rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        <option value={15}>Every 15 seconds</option>
                        <option value={30}>Every 30 seconds</option>
                        <option value={60}>Every 1 minute</option>
                        <option value={120}>Every 2 minutes</option>
                        <option value={300}>Every 5 minutes</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border-2 border-red-400 rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-center">
                <svg className="w-6 h-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}
          
          {/* No Event Selected */}
          {!selectedEventId && (
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shadow-lg p-12 text-center">
              <svg className="mx-auto h-20 w-20 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-xl font-semibold text-gray-700">No Event Selected</p>
              <p className="mt-2 text-lg text-gray-600">Please select an event from the dropdown above to display tournaments</p>
            </div>
          )}
          
          {/* Fixtures Grid */}
          {selectedEventId && fixtures.length === 0 && (
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl shadow-lg p-12 text-center border-2 border-orange-200">
              <svg className="mx-auto h-20 w-20 text-orange-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-xl font-semibold text-orange-700">No Tournaments Found</p>
              <p className="mt-2 text-lg text-orange-600">No knockout tournaments are available for this event</p>
            </div>
          )}
          
          {selectedEventId && fixtures.length > 0 && (
            <div>
              {/* Fixture Navigation */}
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl shadow-lg p-6 mb-6 border border-gray-300">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Navigation Controls */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Navigate Fixtures</label>
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => setSelectedFixtureIndex(Math.max(0, selectedFixtureIndex - 1))}
                        disabled={selectedFixtureIndex === 0}
                        className="p-3 rounded-lg bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <div className="flex-1 text-center">
                        <p className="text-base font-medium text-gray-700 mb-2">
                          Fixture {selectedFixtureIndex + 1} of {fixtures.length}
                        </p>
                        <select
                          value={selectedFixtureIndex}
                          onChange={(e) => setSelectedFixtureIndex(Number(e.target.value))}
                          className="w-full px-4 py-2.5 text-base rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          {fixtures.map((fixture, index) => (
                            <option key={fixture._id} value={index}>
                              {fixture.sportGameId.title} - {fixture.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <button
                        onClick={() => setSelectedFixtureIndex(Math.min(fixtures.length - 1, selectedFixtureIndex + 1))}
                        disabled={selectedFixtureIndex === fixtures.length - 1}
                        className="p-3 rounded-lg bg-indigo-100 hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Auto-cycle Controls */}
                  <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">Auto-Cycle Settings</label>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">Automatically rotate through all fixtures</p>
                      <select
                        value={autoCycleInterval}
                        className="w-full px-4 py-2.5 text-base rounded-lg border-2 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 bg-white"
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setAutoCycleInterval(value);
                        }}
                      >
                        <option value={0}>Disabled</option>
                        <option value={30}>Every 30 seconds</option>
                        <option value={60}>Every 1 minute</option>
                        <option value={120}>Every 2 minutes</option>
                      </select>
                      {autoCycleInterval > 0 && (
                        <p className="text-sm text-green-600 font-medium">
                          ✓ Auto-cycling active
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Single Fixture Display */}
              {fixtures[selectedFixtureIndex] && (
                <div className="bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-gray-300">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-3xl font-bold text-white">
                          {fixtures[selectedFixtureIndex].sportGameId.title}
                        </h3>
                        <p className="text-xl text-indigo-100 mt-2">
                          {fixtures[selectedFixtureIndex].name} - {fixtures[selectedFixtureIndex].participantType === 'player' ? 'Individual' : 'Team'} Tournament
                        </p>
                      </div>
                      <span className={`px-6 py-3 text-lg font-bold rounded-full shadow-lg ${
                        fixtures[selectedFixtureIndex].status === 'completed' ? 'bg-green-500 text-white' :
                        fixtures[selectedFixtureIndex].status === 'in_progress' ? 'bg-yellow-500 text-white' :
                        fixtures[selectedFixtureIndex].status === 'scheduled' ? 'bg-blue-500 text-white' :
                        'bg-gray-500 text-white'
                      }`}>
                        {fixtures[selectedFixtureIndex].status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-8 bg-gradient-to-br from-gray-50 to-gray-100">
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