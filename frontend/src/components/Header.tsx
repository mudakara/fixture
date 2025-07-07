'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { useMsal } from '@azure/msal-react';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { instance } = useMsal();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      // Clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
      }
      
      // Clear Redux state
      dispatch(logout());
      
      // Clear MSAL session
      if (instance.getAllAccounts().length > 0) {
        await instance.logoutPopup();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always redirect to login
      router.push('/login');
    }
  };

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
    { name: 'Sports & Games', href: '/sportgames', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
    { name: 'Events', href: '/events', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
    { name: 'Teams', href: '/teams', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
    { name: 'Fixtures', href: '/fixtures', roles: ['super_admin', 'admin', 'captain', 'vicecaptain'] },
    { name: 'Players', href: '/players', roles: ['super_admin', 'admin', 'captain', 'vicecaptain'] },
    { name: 'Reports', href: '/reports', roles: ['super_admin', 'admin'] },
    { name: 'Roles', href: '/roles', roles: ['super_admin'] },
  ];

  const visibleMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Company Name */}
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                M
              </div>
              <span className="ml-3 text-xl font-semibold text-gray-900">MatchMaker Pro</span>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex space-x-8">
            {visibleMenuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-700 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-gray-600 font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="ml-3 text-gray-700 font-medium">{user?.name || 'User'}</span>
                <svg className="ml-2 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                  <div className="py-1" role="menu">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Settings
                    </Link>
                    <hr className="my-1" />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="md:hidden px-4 pb-3">
        <nav className="space-y-1">
          {visibleMenuItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="block text-gray-700 hover:text-indigo-600 py-2 text-base font-medium"
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}