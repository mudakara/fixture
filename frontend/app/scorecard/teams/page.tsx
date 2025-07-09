'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';

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
                              // Show breakdown modal or expand row
                              alert(`Breakdown for ${team.teamName}:\n\n${
                                team.breakdown.map(b => 
                                  `${b.activityName}: ${b.position === 1 ? '1st' : b.position === 2 ? '2nd' : '3rd'} place - ${b.points} points`
                                ).join('\n')
                              }`);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                          >
                            View Details
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
            <h2 className="text-lg font-medium text-gray-900 mb-4">Points Reference</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities
                .filter(activity => activity.points?.first || activity.points?.second || activity.points?.third)
                .map((activity) => (
                  <div key={activity._id} className="bg-white shadow rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-2">{activity.title}</h3>
                    <div className="space-y-1 text-sm">
                      {activity.points.first > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">1st Place:</span>
                          <span className="font-medium">{activity.points.first} pts</span>
                        </div>
                      )}
                      {activity.points.second > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">2nd Place:</span>
                          <span className="font-medium">{activity.points.second} pts</span>
                        </div>
                      )}
                      {activity.points.third > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">3rd Place:</span>
                          <span className="font-medium">{activity.points.third} pts</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
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