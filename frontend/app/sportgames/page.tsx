'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/utils/imageUrl';

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
  isDoubles?: boolean;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

function SportGamesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [sportGames, setSportGames] = useState<SportGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'sport' | 'game'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  useEffect(() => {
    fetchSportGames();
    fetchCategories();
  }, [filterType, selectedCategory, searchQuery]);

  const fetchSportGames = async () => {
    try {
      let url = `${process.env.NEXT_PUBLIC_API_URL}/sportgames?`;
      
      if (filterType !== 'all') {
        url += `type=${filterType}&`;
      }
      
      if (selectedCategory !== 'all') {
        url += `category=${selectedCategory}&`;
      }
      
      if (searchQuery) {
        url += `search=${encodeURIComponent(searchQuery)}`;
      }
      
      const response = await axios.get(url, {
        withCredentials: true
      });
      
      setSportGames(response.data.sportGames);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sports and games');
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames-categories`,
        { withCredentials: true }
      );
      setCategories(response.data.categories);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }

    try {
      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames/${id}`,
        { withCredentials: true }
      );
      
      // Refresh the list
      fetchSportGames();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete sport/game');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Activity</h1>
              <p className="text-gray-600 mt-1">Browse and manage available activities</p>
            </div>
            {isAdmin && (
              <Link
                href="/sportgames/create"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add New
              </Link>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white shadow rounded-lg mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or description..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                />
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | 'sport' | 'game')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="all">All Types</option>
                  <option value="sport">Sports</option>
                  <option value="game">Games</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                >
                  <option value="all">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Sports & Games Grid */}
          {sportGames.length === 0 ? (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No activities found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isAdmin ? 'Get started by creating a new activity.' : 'Check back later for available activities.'}
              </p>
              {isAdmin && (
                <div className="mt-6">
                  <Link
                    href="/sportgames/create"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add First Activity
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sportGames.map((sportGame) => (
                <div
                  key={sportGame._id}
                  className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
                >
                  <div className="relative h-48 bg-gray-200">
                    {sportGame.image ? (
                      <Image
                        src={getImageUrl(sportGame.image)}
                        alt={sportGame.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {sportGame.type === 'sport' ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                          )}
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sportGame.type === 'sport' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {sportGame.type}
                      </span>
                      {sportGame.isDoubles && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          Doubles
                        </span>
                      )}
                      {sportGame.hasMultipleSets && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                          {sportGame.numberOfSets} Sets
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="px-4 py-5 sm:p-6">
                    <h3 className="text-lg font-medium text-gray-900">
                      <Link href={`/sportgames/${sportGame._id}`} className="hover:text-indigo-600">
                        {sportGame.title}
                      </Link>
                    </h3>
                    
                    {sportGame.category && (
                      <p className="text-sm text-gray-500 mt-1">
                        Category: {sportGame.category}
                      </p>
                    )}
                    
                    {sportGame.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {sportGame.description}
                      </p>
                    )}
                    
                    <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                      <div className="flex items-center space-x-4">
                        {sportGame.minPlayers && (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            {sportGame.minPlayers}{sportGame.maxPlayers && `-${sportGame.maxPlayers}`}
                          </span>
                        )}
                        {sportGame.duration && (
                          <span className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {sportGame.duration}min
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {isAdmin && (
                      <div className="mt-4 flex items-center justify-between">
                        <Link
                          href={`/sportgames/${sportGame._id}/edit`}
                          className="text-sm text-indigo-600 hover:text-indigo-500"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(sportGame._id, sportGame.title)}
                          className="text-sm text-red-600 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SportGamesPage() {
  return (
    <AuthGuard>
      <SportGamesContent />
    </AuthGuard>
  );
}