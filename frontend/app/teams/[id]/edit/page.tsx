'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, use } from 'react';
import axios from 'axios';
import Link from 'next/link';
import Image from 'next/image';
import { getImageUrl } from '@/utils/imageUrl';

interface User {
  _id: string;
  name: string;
  email: string;
  displayName?: string;
}

interface Team {
  _id: string;
  name: string;
  teamLogo?: string;
  eventId: {
    _id: string;
    name: string;
  };
  captainId: {
    _id: string;
    name: string;
    email: string;
    displayName?: string;
  };
  viceCaptainId: {
    _id: string;
    name: string;
    email: string;
    displayName?: string;
  };
}

function EditTeamContent({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form fields
  const [name, setName] = useState('');
  const [teamLogo, setTeamLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [captainId, setCaptainId] = useState('');
  const [viceCaptainId, setViceCaptainId] = useState('');
  
  // User lists for dropdowns
  const [users, setUsers] = useState<User[]>([]);
  const [captainSearch, setCaptainSearch] = useState('');
  const [viceCaptainSearch, setViceCaptainSearch] = useState('');
  const [showCaptainDropdown, setShowCaptainDropdown] = useState(false);
  const [showViceCaptainDropdown, setShowViceCaptainDropdown] = useState(false);
  
  useEffect(() => {
    fetchTeamDetails();
    fetchUsers();
  }, [resolvedParams.id]);

  const fetchTeamDetails = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/teams/${resolvedParams.id}`,
        { withCredentials: true }
      );
      const teamData = response.data.team;
      setTeam(teamData);
      setName(teamData.name);
      setCaptainId(teamData.captainId._id);
      setViceCaptainId(teamData.viceCaptainId._id);
      setCaptainSearch(teamData.captainId.displayName || teamData.captainId.name);
      setViceCaptainSearch(teamData.viceCaptainId.displayName || teamData.viceCaptainId.name);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch team details');
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        { withCredentials: true }
      );
      setUsers(response.data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTeamLogo(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Team name is required');
      return;
    }

    if (!captainId || !viceCaptainId) {
      setError('Please select both captain and vice-captain');
      return;
    }

    if (captainId === viceCaptainId) {
      setError('Captain and vice-captain must be different users');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('captainId', captainId);
      formData.append('viceCaptainId', viceCaptainId);
      
      if (teamLogo) {
        formData.append('teamLogo', teamLogo);
      }

      const response = await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/teams/${resolvedParams.id}`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setSuccess('Team updated successfully');
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/teams/${resolvedParams.id}`);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const canEditTeam = () => {
    if (!team || !user) return false;
    const isAdmin = user.role === 'super_admin' || user.role === 'admin';
    const isCaptain = team.captainId._id === user._id;
    return isAdmin || isCaptain;
  };

  const filteredCaptains = users.filter(u =>
    (u.displayName || u.name).toLowerCase().includes(captainSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(captainSearch.toLowerCase())
  );

  const filteredViceCaptains = users.filter(u =>
    (u.displayName || u.name).toLowerCase().includes(viceCaptainSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(viceCaptainSearch.toLowerCase())
  );

  if (loading) return <div>Loading...</div>;
  if (!team) return <div>Team not found</div>;
  if (!canEditTeam()) return <div>You don't have permission to edit this team</div>;

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <Link
              href={`/teams/${team._id}`}
              className="text-indigo-600 hover:text-indigo-500 flex items-center"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Team Details
            </Link>
          </div>

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Team</h1>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
                  {success}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Team Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Team Logo
                  </label>
                  <div className="mt-1 flex items-center space-x-4">
                    {(logoPreview || team.teamLogo) && (
                      <div className="relative h-20 w-20 rounded-lg overflow-hidden">
                        <Image
                          src={logoPreview || getImageUrl(team.teamLogo!)}
                          alt="Team logo preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Max file size: 5MB. Supported formats: JPEG, PNG, GIF, WebP
                  </p>
                </div>

                {isAdmin && (
                  <>
                    <div className="relative">
                      <label htmlFor="captain" className="block text-sm font-medium text-gray-700">
                        Captain *
                      </label>
                      <input
                        type="text"
                        id="captain"
                        value={captainSearch}
                        onChange={(e) => {
                          setCaptainSearch(e.target.value);
                          setShowCaptainDropdown(true);
                        }}
                        onFocus={() => setShowCaptainDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowCaptainDropdown(false), 200);
                        }}
                        placeholder="Search for captain..."
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      />
                      {showCaptainDropdown && filteredCaptains.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                          {filteredCaptains.map((u) => (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => {
                                setCaptainId(u._id);
                                setCaptainSearch(u.displayName || u.name);
                                setShowCaptainDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            >
                              <div className="font-medium text-gray-900">{u.displayName || u.name}</div>
                              <div className="text-sm text-gray-500">{u.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label htmlFor="viceCaptain" className="block text-sm font-medium text-gray-700">
                        Vice Captain *
                      </label>
                      <input
                        type="text"
                        id="viceCaptain"
                        value={viceCaptainSearch}
                        onChange={(e) => {
                          setViceCaptainSearch(e.target.value);
                          setShowViceCaptainDropdown(true);
                        }}
                        onFocus={() => setShowViceCaptainDropdown(true)}
                        onBlur={() => {
                          setTimeout(() => setShowViceCaptainDropdown(false), 200);
                        }}
                        placeholder="Search for vice captain..."
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                      />
                      {showViceCaptainDropdown && filteredViceCaptains.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto">
                          {filteredViceCaptains.map((u) => (
                            <button
                              key={u._id}
                              type="button"
                              onClick={() => {
                                setViceCaptainId(u._id);
                                setViceCaptainSearch(u.displayName || u.name);
                                setShowViceCaptainDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-100"
                            >
                              <div className="font-medium text-gray-900">{u.displayName || u.name}</div>
                              <div className="text-sm text-gray-500">{u.email}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!isAdmin && (
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600">
                      <strong>Note:</strong> As a team captain, you can only update the team name and logo. 
                      Contact an administrator to change team captains.
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <Link
                    href={`/teams/${team._id}`}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
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

export default function EditTeamPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AuthGuard>
      <EditTeamContent params={params} />
    </AuthGuard>
  );
}