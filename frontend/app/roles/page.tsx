'use client';

import { AuthGuard } from '@/components/AuthGuard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  authProvider: string;
  createdAt: string;
  lastLogin?: string;
  displayName?: string;
  department?: string;
  jobTitle?: string;
}

interface Permission {
  resource: string;
  actions: string[];
}

interface RolePermissions {
  [role: string]: Permission[];
}

const defaultPermissions: RolePermissions = {
  super_admin: [
    { resource: 'users', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'events', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'teams', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'fixtures', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'players', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'reports', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'roles', actions: ['read', 'update'] },
    { resource: 'permissions', actions: ['read', 'update'] }
  ],
  admin: [
    { resource: 'events', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'teams', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'fixtures', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'players', actions: ['create', 'read', 'update'] },
    { resource: 'reports', actions: ['read'] }
  ],
  captain: [
    { resource: 'events', actions: ['read'] },
    { resource: 'teams', actions: ['read', 'update'] },
    { resource: 'fixtures', actions: ['read', 'update'] },
    { resource: 'players', actions: ['read', 'update'] }
  ],
  vicecaptain: [
    { resource: 'events', actions: ['read'] },
    { resource: 'teams', actions: ['read', 'update'] },
    { resource: 'fixtures', actions: ['read', 'update'] },
    { resource: 'players', actions: ['read', 'update'] }
  ],
  player: [
    { resource: 'events', actions: ['read'] },
    { resource: 'teams', actions: ['read'] },
    { resource: 'fixtures', actions: ['read'] },
    { resource: 'players', actions: ['read'] }
  ]
};

function RolesContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'users' | 'permissions'>('users');
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'name' | 'role' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    role: 'player'
  });

  useEffect(() => {
    if (user?.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }
    fetchUsers();
  }, [user, router]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
        withCredentials: true
      });
      setUsers(response.data.users);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
      setLoading(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      await axios.put(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`,
        { role: newRole },
        { withCredentials: true }
      );
      
      // Update local state
      setUsers(users.map(u => 
        u._id === userId ? { ...u, role: newRole } : u
      ));
      
      setEditingUserId(null);
      setEditingRole('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handlePermissionToggle = (role: string, resource: string, action: string) => {
    setPermissions(prev => {
      const rolePerms = prev[role] || [];
      const resourcePerm = rolePerms.find(p => p.resource === resource);
      
      if (resourcePerm) {
        if (resourcePerm.actions.includes(action)) {
          // Remove action
          resourcePerm.actions = resourcePerm.actions.filter(a => a !== action);
        } else {
          // Add action
          resourcePerm.actions.push(action);
        }
      } else {
        // Add new resource permission
        rolePerms.push({ resource, actions: [action] });
      }
      
      return { ...prev, [role]: rolePerms };
    });
  };

  const handleSavePermissions = async () => {
    try {
      // Save permissions for each role (except super_admin)
      for (const [role, perms] of Object.entries(permissions)) {
        if (role !== 'super_admin') {
          await axios.put(
            `${process.env.NEXT_PUBLIC_API_URL}/permissions/${role}`,
            { permissions: perms },
            { withCredentials: true }
          );
        }
      }
      alert('Permissions saved successfully!');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save permissions');
    }
  };

  const handleAddUser = async () => {
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/users`,
        newUser,
        { withCredentials: true }
      );
      
      if (response.data.success) {
        // Refresh users list
        fetchUsers();
        // Reset form and close modal
        setNewUser({
          name: '',
          email: '',
          password: '',
          role: 'player'
        });
        setShowAddUserModal(false);
        alert('User created successfully!');
      }
    } catch (err: any) {
      console.error('User creation error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}`,
        { withCredentials: true }
      );

      if (response.data.success) {
        // Remove user from local state
        setUsers(users.filter(u => u._id !== userId));
        alert('User deleted successfully!');
      }
    } catch (err: any) {
      console.error('User deletion error:', err);
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleSort = (field: 'name' | 'role') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    if (!sortField) return 0;
    
    const aValue = sortField === 'name' ? (a.displayName || a.name) : a.role;
    const bValue = sortField === 'name' ? (b.displayName || b.name) : b.role;
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (user?.role !== 'super_admin') return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex">
                <button
                  onClick={() => setSelectedTab('users')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    selectedTab === 'users'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Users & Roles
                </button>
                <button
                  onClick={() => setSelectedTab('permissions')}
                  className={`py-2 px-6 border-b-2 font-medium text-sm ${
                    selectedTab === 'permissions'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Permissions
                </button>
              </nav>
            </div>

            <div className="px-4 py-5 sm:p-6">
              {selectedTab === 'users' ? (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add User
                    </button>
                  </div>
                  <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort('name')}
                              className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                            >
                              <span>Name</span>
                              <div className="flex flex-col">
                                <svg className={`w-3 h-3 ${sortField === 'name' && sortDirection === 'asc' ? 'text-indigo-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 10l5-5 5 5H7z" />
                                </svg>
                                <svg className={`w-3 h-3 -mt-1 ${sortField === 'name' && sortDirection === 'desc' ? 'text-indigo-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 10l5 5 5-5H7z" />
                                </svg>
                              </div>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Auth Type
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <button
                              onClick={() => handleSort('role')}
                              className="flex items-center space-x-1 hover:text-gray-700 focus:outline-none"
                            >
                              <span>Current Role</span>
                              <div className="flex flex-col">
                                <svg className={`w-3 h-3 ${sortField === 'role' && sortDirection === 'asc' ? 'text-indigo-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 10l5-5 5 5H7z" />
                                </svg>
                                <svg className={`w-3 h-3 -mt-1 ${sortField === 'role' && sortDirection === 'desc' ? 'text-indigo-600' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M7 10l5 5 5-5H7z" />
                                </svg>
                              </div>
                            </button>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Login
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role Actions
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            User Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedUsers.map((user) => (
                          <tr key={user._id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {user.displayName || user.name}
                              </div>
                              {user.department && (
                                <div className="text-sm text-gray-500">{user.department}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{user.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                {user.authProvider === 'azuread' ? 'Azure AD' : 'Local'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {editingUserId === user._id ? (
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={editingRole}
                                    onChange={(e) => setEditingRole(e.target.value)}
                                    className="block w-full px-3 py-2 text-base border-2 border-indigo-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 bg-white text-gray-900"
                                    style={{ minWidth: '150px' }}
                                  >
                                    <option value="">Select role</option>
                                    <option value="super_admin">Super Admin</option>
                                    <option value="admin">Admin</option>
                                    <option value="captain">Captain</option>
                                    <option value="vicecaptain">Vice Captain</option>
                                    <option value="player">Player</option>
                                  </select>
                                </div>
                              ) : (
                                <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${
                                  user.role === 'super_admin' ? 'bg-red-100 text-red-800' :
                                  user.role === 'admin' ? 'bg-orange-100 text-orange-800' :
                                  user.role === 'captain' ? 'bg-yellow-100 text-yellow-800' :
                                  user.role === 'vicecaptain' ? 'bg-blue-100 text-blue-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {user.role.replace('_', ' ').charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 
                               new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {editingUserId === user._id ? (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleRoleUpdate(user._id, editingRole)}
                                    disabled={!editingRole}
                                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingUserId(null);
                                      setEditingRole('');
                                    }}
                                    className="px-3 py-1 bg-gray-400 text-white rounded-md hover:bg-gray-500 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingUserId(user._id);
                                    setEditingRole(user.role);
                                  }}
                                  className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                                >
                                  Edit Role
                                </button>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              {user.role !== 'super_admin' ? (
                                <button
                                  onClick={() => handleDeleteUser(user._id)}
                                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              ) : (
                                <span className="px-3 py-1 text-gray-400 italic">Protected</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 mb-6">Role Permissions</h1>
                  <div className="space-y-6">
                    {Object.entries(permissions).map(([role, perms]) => (
                      <div key={role} className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 capitalize">{role}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {['users', 'events', 'teams', 'fixtures', 'players', 'reports', 'roles', 'permissions'].map(resource => {
                            const resourcePerms = perms.find(p => p.resource === resource);
                            return (
                              <div key={resource} className="bg-white rounded-md p-3">
                                <h4 className="font-medium text-gray-700 capitalize mb-2">{resource}</h4>
                                <div className="space-y-1">
                                  {['create', 'read', 'update', 'delete'].map(action => (
                                    <label key={action} className="flex items-center">
                                      <input
                                        type="checkbox"
                                        checked={resourcePerms?.actions.includes(action) || false}
                                        onChange={() => handlePermissionToggle(role, resource, action)}
                                        disabled={role === 'super_admin'} // Super admin always has all permissions
                                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                      />
                                      <span className="ml-2 text-sm text-gray-600 capitalize">{action}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <button 
                      onClick={handleSavePermissions}
                      className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                    >
                      Save Permissions
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowAddUserModal(false)}></div>
            
            <div className="relative bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                handleAddUser();
              }}>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                    <input
                      type="text"
                      required
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      className="block w-full px-3 py-2 text-base rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="block w-full px-3 py-2 text-base rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                    <input
                      type="password"
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      className="block w-full px-3 py-2 text-base rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-gray-900"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                    <select
                      required
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="block w-full px-3 py-2 text-base rounded-md border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-gray-900"
                    >
                      <option value="player">Player</option>
                      <option value="vicecaptain">Vice Captain</option>
                      <option value="captain">Captain</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="bg-white px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-indigo-600 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RolesPage() {
  return (
    <AuthGuard>
      <RolesContent />
    </AuthGuard>
  );
}