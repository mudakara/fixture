'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import React from 'react';

interface TeamPoints {
  teamId: string;
  teamName: string;
  eventId: string;
  eventName: string;
  totalPoints: number;
  breakdown: {
    activityId: string;
    activityName: string;
    position: 1 | 2 | 3;
    points: number;
  }[];
}

interface Activity {
  _id: string;
  title: string;
  points: {
    first: number;
    second: number;
    third: number;
  };
}

function TeamPointsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [teamPoints, setTeamPoints] = useState<TeamPoints[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamPoints | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [pointsSortField, setPointsSortField] = useState<'activity' | 'first' | null>(null);
  const [pointsSortDirection, setPointsSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchData();
  }, [selectedEventId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch events
      const eventsResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/events`,
        { withCredentials: true }
      );
      setEvents(eventsResponse.data.events);

      // Fetch activities
      const activitiesResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames`,
        { withCredentials: true }
      );
      console.log('Fetched activities:', activitiesResponse.data.sportGames);
      setActivities(activitiesResponse.data.sportGames);

      // Fetch team points
      let url = `${process.env.NEXT_PUBLIC_API_URL}/scorecard/teams`;
      if (selectedEventId !== 'all') {
        url += `?eventId=${selectedEventId}`;
      }
      
      const pointsResponse = await axios.get(url, {
        withCredentials: true
      });
      
      setTeamPoints(pointsResponse.data.teamPoints);
      
      // Also log debug info if available
      if (pointsResponse.data.debug) {
        console.log('Scorecard Debug Info:', pointsResponse.data.debug);
      }
      
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch team points');
      setLoading(false);
    }
  };

  const handlePointsSort = (field: 'activity' | 'first') => {
    if (pointsSortField === field) {
      setPointsSortDirection(pointsSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setPointsSortField(field);
      setPointsSortDirection('asc');
    }
  };

  const sortActivities = (activities: Activity[]) => {
    const filtered = activities.filter(activity => 
      activity.points && (activity.points.first > 0 || activity.points.second > 0 || activity.points.third > 0)
    );

    if (!pointsSortField) return filtered;

    return [...filtered].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (pointsSortField === 'activity') {
        aValue = a.title.toLowerCase();
        bValue = b.title.toLowerCase();
      } else {
        aValue = a.points.first;
        bValue = b.points.first;
      }

      if (aValue < bValue) return pointsSortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return pointsSortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading team points...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-800">{error}</p>
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
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Team Points Scorecard</h1>
              <p className="text-gray-600 mt-1">Track team rankings and points across activities</p>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white shadow rounded-lg mb-6 p-4">
            <div className="flex items-center space-x-4">
              <label htmlFor="event-filter" className="text-sm font-medium text-gray-700">
                Filter by Event:
              </label>
              <select
                id="event-filter"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
              >
                <option value="all">All Events</option>
                {events.map((event) => (
                  <option key={event._id} value={event._id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Points Table */}
          {teamPoints.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No points data</h3>
              <p className="mt-1 text-sm text-gray-500">
                Team points will appear here once tournaments are completed.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activities Won
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Points
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamPoints
                    .sort((a, b) => b.totalPoints - a.totalPoints)
                    .map((team, index) => (
                      <tr key={team.teamId} className={index < 3 ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {index === 0 && (
                              <span className="text-2xl mr-2">🥇</span>
                            )}
                            {index === 1 && (
                              <span className="text-2xl mr-2">🥈</span>
                            )}
                            {index === 2 && (
                              <span className="text-2xl mr-2">🥉</span>
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {index + 1}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {team.teamName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {team.eventName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900">
                              {team.breakdown.filter(b => b.position === 1).length} 🥇
                            </span>
                            <span className="text-sm text-gray-900">
                              {team.breakdown.filter(b => b.position === 2).length} 🥈
                            </span>
                            <span className="text-sm text-gray-900">
                              {team.breakdown.filter(b => b.position === 3).length} 🥉
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-lg font-semibold text-indigo-600">
                            {team.totalPoints}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedTeam(team);
                              setShowDetailsModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center space-x-1"
                          >
                            <span>View Details</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Activities Points Reference */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Points Reference</h2>
              <div className="flex items-center text-sm text-gray-500">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Points awarded for activity rankings
              </div>
            </div>
            
            {activities.filter(activity => activity.points && (activity.points.first > 0 || activity.points.second > 0 || activity.points.third > 0)).length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
                <svg className="w-12 h-12 text-amber-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Point Values Configured</h3>
                <p className="text-gray-600">Activities need point values to appear here. Configure points when creating or editing activities.</p>
              </div>
            ) : (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handlePointsSort('activity')}
                          className="group inline-flex items-center space-x-1 hover:text-gray-700"
                        >
                          <span>Activity</span>
                          <span className="flex-none rounded text-gray-400 group-hover:text-gray-700">
                            {pointsSortField === 'activity' ? (
                              pointsSortDirection === 'asc' ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <button
                          onClick={() => handlePointsSort('first')}
                          className="group inline-flex items-center justify-center space-x-1 hover:text-gray-700"
                        >
                          <span className="text-lg">🥇</span>
                          <span>1st Place</span>
                          <span className="flex-none rounded text-gray-400 group-hover:text-gray-700">
                            {pointsSortField === 'first' ? (
                              pointsSortDirection === 'asc' ? (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )
                            ) : (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center justify-center space-x-1">
                          <span className="text-lg">🥈</span>
                          <span>2nd Place</span>
                        </div>
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="flex items-center justify-center space-x-1">
                          <span className="text-lg">🥉</span>
                          <span>3rd Place</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sortActivities(activities)
                      .map((activity, index) => (
                      <tr key={activity._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{activity.title}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {activity.points.first > 0 ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800">
                              {activity.points.first} pts
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {activity.points.second > 0 ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800">
                              {activity.points.second} pts
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {activity.points.third > 0 ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-100 text-orange-800">
                              {activity.points.third} pts
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Details Modal */}
      {showDetailsModal && selectedTeam && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-xl transform transition-all">
            {/* Modal Header */}
            <div className="bg-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">{selectedTeam.teamName}</h3>
                  <p className="text-sm text-indigo-200">{selectedTeam.eventName}</p>
                </div>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedTeam(null);
                  }}
                  className="text-white hover:text-indigo-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Body */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-3xl mb-1">🥇</div>
                  <div className="text-2xl font-bold text-yellow-600">
                    {selectedTeam.breakdown.filter(b => b.position === 1).length}
                  </div>
                  <div className="text-sm text-gray-600">First Places</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl mb-1">🥈</div>
                  <div className="text-2xl font-bold text-gray-600">
                    {selectedTeam.breakdown.filter(b => b.position === 2).length}
                  </div>
                  <div className="text-sm text-gray-600">Second Places</div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-3xl mb-1">🥉</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {selectedTeam.breakdown.filter(b => b.position === 3).length}
                  </div>
                  <div className="text-sm text-gray-600">Third Places</div>
                </div>
              </div>
              
              {/* Detailed Breakdown */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 text-lg">Activity Breakdown</h4>
                {selectedTeam.breakdown.map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <span className="text-2xl">
                        {activity.position === 1 ? '🥇' : activity.position === 2 ? '🥈' : '🥉'}
                      </span>
                      <div>
                        <h5 className="font-medium text-gray-900">{activity.activityName}</h5>
                        <p className="text-sm text-gray-500">
                          {activity.position === 1 ? '1st' : activity.position === 2 ? '2nd' : '3rd'} Place
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">{activity.points}</div>
                      <div className="text-sm text-gray-500">points</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-600">Total Points</span>
                </div>
                <div className="text-3xl font-bold text-indigo-600">
                  {selectedTeam.totalPoints}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamPointsPage() {
  return (
    <AuthGuard>
      <TeamPointsContent />
    </AuthGuard>
  );
}