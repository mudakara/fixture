'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import Image from 'next/image';

function CreateSportGameContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
    isDoubles: false,
    hasMultipleSets: false,
    numberOfSets: '1',
    image: null as File | null,
    points: {
      first: '',
      second: '',
      third: ''
    }
  });

  // Check permissions
  const canCreate = user?.role === 'super_admin' || user?.role === 'admin';
  
  if (!canCreate) {
    router.push('/sportgames');
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handlePointsChange = (rank: 'first' | 'second' | 'third', value: string) => {
    setFormData(prev => ({
      ...prev,
      points: {
        ...prev.points,
        [rank]: value
      }
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
      formDataToSend.append('isDoubles', formData.isDoubles.toString());
      formDataToSend.append('hasMultipleSets', formData.hasMultipleSets.toString());
      if (formData.hasMultipleSets && formData.numberOfSets) {
        formDataToSend.append('numberOfSets', formData.numberOfSets);
      }
      if (formData.image) formDataToSend.append('image', formData.image);
      
      // Add points
      const pointsData = {
        first: parseInt(formData.points.first) || 0,
        second: parseInt(formData.points.second) || 0,
        third: parseInt(formData.points.third) || 0
      };
      formDataToSend.append('points', JSON.stringify(pointsData));

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/sportgames`,
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
      setError(err.response?.data?.error || 'Failed to create sport/game');
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
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
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
      } else {
        setError('Please upload an image file');
        setTimeout(() => setError(null), 3000);
      }
    }
  };

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
                <h1 className="text-2xl font-bold text-gray-900">Create New Activity</h1>
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

                {/* Is Doubles */}
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="isDoubles"
                      id="isDoubles"
                      checked={formData.isDoubles}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isDoubles" className="ml-2 block text-sm text-gray-900">
                      Is it Doubles?
                    </label>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Check this if the activity is played in doubles format (e.g., badminton doubles, tennis doubles)
                  </p>
                </div>

                {/* Has Multiple Sets */}
                <div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="hasMultipleSets"
                      id="hasMultipleSets"
                      checked={formData.hasMultipleSets}
                      onChange={handleInputChange}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="hasMultipleSets" className="ml-2 block text-sm text-gray-900">
                      How many Sets?
                    </label>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Check this if matches are played in multiple sets (e.g., best of 3 sets, best of 5 sets)
                  </p>
                  
                  {formData.hasMultipleSets && (
                    <div className="mt-3">
                      <label htmlFor="numberOfSets" className="block text-sm font-medium text-gray-700">
                        Number of Sets
                      </label>
                      <select
                        name="numberOfSets"
                        id="numberOfSets"
                        value={formData.numberOfSets}
                        onChange={handleInputChange}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      >
                        <option value="1">1 Set</option>
                        <option value="2">2 Sets</option>
                        <option value="3">3 Sets</option>
                        <option value="4">4 Sets</option>
                        <option value="5">5 Sets</option>
                      </select>
                      <p className="mt-1 text-sm text-gray-500">
                        Select the maximum number of sets to be played
                      </p>
                    </div>
                  )}
                </div>

                {/* Points Configuration */}
                <div className="col-span-2">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Points Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="points-first" className="block text-sm font-medium text-gray-700">
                        1st Place Points
                      </label>
                      <input
                        type="number"
                        id="points-first"
                        min="0"
                        value={formData.points.first}
                        onChange={(e) => handlePointsChange('first', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="points-second" className="block text-sm font-medium text-gray-700">
                        2nd Place Points
                      </label>
                      <input
                        type="number"
                        id="points-second"
                        min="0"
                        value={formData.points.second}
                        onChange={(e) => handlePointsChange('second', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label htmlFor="points-third" className="block text-sm font-medium text-gray-700">
                        3rd Place Points
                      </label>
                      <input
                        type="number"
                        id="points-third"
                        min="0"
                        value={formData.points.third}
                        onChange={(e) => handlePointsChange('third', e.target.value)}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Points awarded to teams based on their final ranking in the tournament
                  </p>
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
                    {imagePreview ? (
                      <div className="relative">
                        <div className="relative h-48 w-full bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={imagePreview}
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
                      <div 
                        className={`flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors ${
                          isDragging 
                            ? 'border-indigo-500 bg-indigo-50' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        <div className="space-y-1 text-center">
                          <svg
                            className={`mx-auto h-12 w-12 ${isDragging ? 'text-indigo-500' : 'text-gray-400'}`}
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
                          <p className="text-xs text-gray-500">
                            {isDragging ? 'Drop image here' : 'PNG, JPG, GIF up to 5MB'}
                          </p>
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
                    {loading ? 'Creating...' : 'Create Activity'}
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

export default function CreateSportGamePage() {
  return (
    <AuthGuard>
      <CreateSportGameContent />
    </AuthGuard>
  );
}