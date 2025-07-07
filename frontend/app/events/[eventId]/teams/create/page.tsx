'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import axios from 'axios';
import Image from 'next/image';

interface User {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
}

interface Event {
  _id: string;
  name: string;
}

function CreateTeamContent({ params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [searchCaptain, setSearchCaptain] = useState('');
  const [searchViceCaptain, setSearchViceCaptain] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    captainId: '',
    viceCaptainId: '',
    teamLogo: null as File | null
  });

  // Check permissions
  const canCreateTeam = user?.role === 'super_admin' || user?.role === 'admin';
  
  useEffect(() => {
    if (!canCreateTeam) {
      router.push(`/events/${resolvedParams.eventId}`);
      return;
    }
    fetchEventAndUsers();
  }, [resolvedParams.eventId, canCreateTeam]);

  const fetchEventAndUsers = async () => {
    try {
      // Fetch event details
      const eventResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/events/${resolvedParams.eventId}`,
        { withCredentials: true }
      );
      setEvent(eventResponse.data.event);

      // Fetch users
      const usersResponse = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        { withCredentials: true }
      );
      setUsers(usersResponse.data.users);
      setLoadingUsers(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data');
      setLoadingUsers(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        teamLogo: file
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
    
    if (formData.captainId === formData.viceCaptainId) {
      setError('Captain and Vice-Captain must be different users');
      return;
    }

    setLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('eventId', resolvedParams.eventId);
      formDataToSend.append('captainId', formData.captainId);
      formDataToSend.append('viceCaptainId', formData.viceCaptainId);
      
      if (formData.teamLogo) {
        formDataToSend.append('teamLogo', formData.teamLogo);
      }

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/teams`,
        formDataToSend,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        router.push(`/teams/${response.data.team._id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create team');
    } finally {
      setLoading(false);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      teamLogo: null
    }));
    setImagePreview(null);
  };

  const filteredCaptainUsers = users.filter(u => 
    (u.displayName || u.name).toLowerCase().includes(searchCaptain.toLowerCase()) ||
    u.email.toLowerCase().includes(searchCaptain.toLowerCase())
  );

  const filteredViceCaptainUsers = users.filter(u => 
    (u.displayName || u.name).toLowerCase().includes(searchViceCaptain.toLowerCase()) ||
    u.email.toLowerCase().includes(searchViceCaptain.toLowerCase())
  );

  if (loadingUsers) return <div>Loading...</div>;
  if (!event) return <div>Event not found</div>;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center mb-6">
                <button
                  onClick={() => router.push(`/events/${resolvedParams.eventId}`)}
                  className="mr-4 text-gray-600 hover:text-gray-900"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Create New Team</h1>
                  <p className="text-sm text-gray-500 mt-1">For {event.name}</p>
                </div>
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    placeholder="Thunder Hawks"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Team Logo
                  </label>
                  <div className="mt-1">
                    {imagePreview ? (
                      <div className="relative">
                        <div className="relative h-32 w-32 bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={imagePreview}
                            alt="Team logo preview"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-2 -right-2 bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
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
                              htmlFor="logo-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                            >
                              <span>Upload a logo</span>
                              <input
                                id="logo-upload"
                                name="logo-upload"
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

                <div>
                  <label htmlFor="captain" className="block text-sm font-medium text-gray-700">
                    Team Captain *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      placeholder="Search for captain..."
                      value={searchCaptain}
                      onChange={(e) => setSearchCaptain(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                    {searchCaptain && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                        {filteredCaptainUsers.length === 0 ? (
                          <div className="px-4 py-2 text-sm text-gray-500">No users found</div>
                        ) : (
                          filteredCaptainUsers.map((u) => (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, captainId: u._id }));
                                setSearchCaptain(u.displayName || u.name);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-900 hover:bg-gray-100"
                            >
                              <div className="font-medium">{u.displayName || u.name}</div>
                              <div className="text-gray-500">{u.email}</div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {formData.captainId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Selected: {users.find(u => u._id === formData.captainId)?.email}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="viceCaptain" className="block text-sm font-medium text-gray-700">
                    Team Vice-Captain *
                  </label>
                  <div className="mt-1 relative">
                    <input
                      type="text"
                      placeholder="Search for vice-captain..."
                      value={searchViceCaptain}
                      onChange={(e) => setSearchViceCaptain(e.target.value)}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                    {searchViceCaptain && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                        {filteredViceCaptainUsers.length === 0 ? (
                          <div className="px-4 py-2 text-sm text-gray-500">No users found</div>
                        ) : (
                          filteredViceCaptainUsers.map((u) => (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, viceCaptainId: u._id }));
                                setSearchViceCaptain(u.displayName || u.name);
                              }}
                              disabled={u._id === formData.captainId}
                              className={`w-full text-left px-4 py-2 text-sm ${
                                u._id === formData.captainId
                                  ? 'text-gray-400 bg-gray-50 cursor-not-allowed'
                                  : 'text-gray-900 hover:bg-gray-100'
                              }`}
                            >
                              <div className="font-medium">{u.displayName || u.name}</div>
                              <div className={u._id === formData.captainId ? 'text-gray-400' : 'text-gray-500'}>
                                {u.email}
                                {u._id === formData.captainId && ' (Already selected as Captain)'}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {formData.viceCaptainId && (
                    <p className="mt-1 text-xs text-gray-500">
                      Selected: {users.find(u => u._id === formData.viceCaptainId)?.email}
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/events/${resolvedParams.eventId}`)}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !formData.captainId || !formData.viceCaptainId}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Creating...' : 'Create Team'}
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

export default function CreateTeamPage({ params }: { params: Promise<{ eventId: string }> }) {
  return (
    <AuthGuard>
      <CreateTeamContent params={params} />
    </AuthGuard>
  );
}