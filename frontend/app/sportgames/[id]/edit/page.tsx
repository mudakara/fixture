'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';
import axios from 'axios';
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
}

function EditSportGameContent({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImage, setExistingImage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'sport' as 'sport' | 'game',
    category: '',
    rules: '',
    minPlayers: '',
    maxPlayers: '',
    duration: '',
    venue: '',
    equipment: '',
    image: null as File | null
  });

  // Check permissions
  const canEdit = user?.role === 'super_admin' || user?.role === 'admin';

  useEffect(() => {
    if (!canEdit) {
      router.push('/sportgames');
      return;
    }
    fetchSportGame();
  }, [id, canEdit, router]);

  const fetchSportGame = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames/${id}`,
        { withCredentials: true }
      );

      const sportGame: SportGame = response.data.sportGame;
      
      // Populate form data
      setFormData({
        title: sportGame.title || '',
        description: sportGame.description || '',
        type: sportGame.type || 'sport',
        category: sportGame.category || '',
        rules: sportGame.rules || '',
        minPlayers: sportGame.minPlayers?.toString() || '',
        maxPlayers: sportGame.maxPlayers?.toString() || '',
        duration: sportGame.duration?.toString() || '',
        venue: sportGame.venue || '',
        equipment: sportGame.equipment?.join(', ') || '',
        image: null
      });

      // Set existing image
      if (sportGame.image) {
        setExistingImage(sportGame.image);
        setImagePreview(getImageUrl(sportGame.image));
      }

      setFetchLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch sport/game');
      setFetchLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file
      }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('type', formData.type);
      
      if (formData.description) formDataToSend.append('description', formData.description);
      if (formData.category) formDataToSend.append('category', formData.category);
      if (formData.rules) formDataToSend.append('rules', formData.rules);
      if (formData.minPlayers) formDataToSend.append('minPlayers', formData.minPlayers);
      if (formData.maxPlayers) formDataToSend.append('maxPlayers', formData.maxPlayers);
      if (formData.duration) formDataToSend.append('duration', formData.duration);
      if (formData.venue) formDataToSend.append('venue', formData.venue);
      if (formData.equipment) formDataToSend.append('equipment', formData.equipment);
      if (formData.image) formDataToSend.append('image', formData.image);

      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames/${id}`,
        formDataToSend,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        router.push('/sportgames');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update sport/game');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      image: null
    }));
    setImagePreview(null);
    setExistingImage(null);
  };

  if (fetchLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="space-y-4">
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => router.push('/sportgames')}
                  className="mr-4 text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Edit Activity</h1>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    required
                    value={formData.title}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="e.g., Basketball, Chess, Cricket"
                  />
                </div>

                {/* Type */}
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                    Type *
                  </label>
                  <select
                    name="type"
                    id="type"
                    required
                    value={formData.type}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                  >
                    <option value="sport">Sport</option>
                    <option value="game">Game</option>
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <input
                    type="text"
                    name="category"
                    id="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="e.g., Team Sport, Board Game, Outdoor"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="Brief description of the sport/game..."
                  />
                </div>

                {/* Players */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="minPlayers" className="block text-sm font-medium text-gray-700">
                      Minimum Players
                    </label>
                    <input
                      type="number"
                      name="minPlayers"
                      id="minPlayers"
                      min="1"
                      value={formData.minPlayers}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700">
                      Maximum Players
                    </label>
                    <input
                      type="number"
                      name="maxPlayers"
                      id="maxPlayers"
                      min="1"
                      value={formData.maxPlayers}
                      onChange={handleInputChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="duration"
                    id="duration"
                    min="1"
                    value={formData.duration}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="e.g., 90"
                  />
                </div>

                {/* Venue */}
                <div>
                  <label htmlFor="venue" className="block text-sm font-medium text-gray-700">
                    Venue/Location Type
                  </label>
                  <input
                    type="text"
                    name="venue"
                    id="venue"
                    value={formData.venue}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="e.g., Basketball Court, Football Field, Indoor"
                  />
                </div>

                {/* Equipment */}
                <div>
                  <label htmlFor="equipment" className="block text-sm font-medium text-gray-700">
                    Equipment (comma-separated)
                  </label>
                  <input
                    type="text"
                    name="equipment"
                    id="equipment"
                    value={formData.equipment}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="e.g., Ball, Net, Racket"
                  />
                  <p className="mt-1 text-sm text-gray-500">Separate multiple items with commas</p>
                </div>

                {/* Rules */}
                <div>
                  <label htmlFor="rules" className="block text-sm font-medium text-gray-700">
                    Rules
                  </label>
                  <textarea
                    name="rules"
                    id="rules"
                    rows={4}
                    value={formData.rules}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="Basic rules or gameplay instructions..."
                  />
                </div>

                {/* Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Image
                  </label>
                  <div className="mt-1">
                    {(imagePreview || existingImage) ? (
                      <div className="relative">
                        <div className="relative h-48 w-full bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={imagePreview || getImageUrl(existingImage!)}
                            alt="Activity preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="image-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                            >
                              <span>Upload an image</span>
                              <input
                                id="image-upload"
                                name="image-upload"
                                type="file"
                                className="sr-only"
                                accept="image/*"
                                onChange={handleImageChange}
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.push('/sportgames')}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating...' : 'Update Activity'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditSportGamePage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js 15 compatibility - unwrap Promise params
  const { id } = use(params);
  
  return (
    <AuthGuard>
      <EditSportGameContent id={id} />
    </AuthGuard>
  );
}