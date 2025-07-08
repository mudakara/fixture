'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { getImageUrl } from '@/utils/imageUrl';
import Link from 'next/link';

interface SportGame {
  _id: string;
  title: string;
  description?: string;
  type: 'sport' | 'game';
  category?: string;
  rules?: string;
  minPlayers?: number;
  maxPlayers?: number;
  duration?: number;
  venue?: string;
  equipment?: string[];
  image?: string;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

function SportGameDetailContent({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [sportGame, setSportGame] = useState<SportGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  useEffect(() => {
    fetchSportGame();
  }, [id]);

  const fetchSportGame = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames/${id}`,
        { withCredentials: true }
      );

      setSportGame(response.data.sportGame);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sport/game');
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${sportGame?.title}"?`)) {
      return;
    }

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames/${id}`,
        { withCredentials: true }
      );
      
      router.push('/sportgames');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete sport/game');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-64 bg-gray-200 rounded mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !sportGame) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900">
                  {error || 'Sport/Game not found'}
                </h3>
                <div className="mt-6">
                  <button
                    onClick={() => router.push('/sportgames')}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    Back to Activities
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            {/* Header with image */}
            <div className="relative h-64 bg-gray-200">
              {sportGame.image ? (
                <Image
                  src={getImageUrl(sportGame.image)}
                  alt={sportGame.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="h-24 w-24 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {sportGame.type === 'sport' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    )}
                  </svg>
                </div>
              )}
              <div className="absolute top-4 right-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  sportGame.type === 'sport' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {sportGame.type}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{sportGame.title}</h1>
                  {sportGame.category && (
                    <p className="mt-1 text-sm text-gray-500">Category: {sportGame.category}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex space-x-3">
                    <Link
                      href={`/sportgames/${id}/edit`}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </Link>
                    <button
                      onClick={handleDelete}
                      className="inline-flex items-center px-3 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {sportGame.description && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700">Description</h3>
                  <p className="mt-2 text-gray-600">{sportGame.description}</p>
                </div>
              )}

              {/* Details Grid */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Players */}
                {(sportGame.minPlayers || sportGame.maxPlayers) && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Players</h3>
                    <p className="mt-2 text-gray-600">
                      {sportGame.minPlayers && sportGame.maxPlayers ? (
                        `${sportGame.minPlayers} - ${sportGame.maxPlayers} players`
                      ) : sportGame.minPlayers ? (
                        `Minimum ${sportGame.minPlayers} players`
                      ) : (
                        `Maximum ${sportGame.maxPlayers} players`
                      )}
                    </p>
                  </div>
                )}

                {/* Duration */}
                {sportGame.duration && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Duration</h3>
                    <p className="mt-2 text-gray-600">{sportGame.duration} minutes</p>
                  </div>
                )}

                {/* Venue */}
                {sportGame.venue && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Venue</h3>
                    <p className="mt-2 text-gray-600">{sportGame.venue}</p>
                  </div>
                )}

                {/* Equipment */}
                {sportGame.equipment && sportGame.equipment.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Equipment</h3>
                    <ul className="mt-2 text-gray-600 list-disc list-inside">
                      {sportGame.equipment.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Rules */}
              {sportGame.rules && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700">Rules</h3>
                  <p className="mt-2 text-gray-600 whitespace-pre-line">{sportGame.rules}</p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div>
                    Created by {sportGame.createdBy.name} on {new Date(sportGame.createdAt).toLocaleDateString()}
                  </div>
                  <button
                    onClick={() => router.push('/sportgames')}
                    className="text-indigo-600 hover:text-indigo-500"
                  >
                    Back to Activities
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SportGameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15 compatibility - unwrap Promise params
  const { id } = use(params);
  
  return (
    <AuthGuard>
      <SportGameDetailContent id={id} />
    </AuthGuard>
  );
}