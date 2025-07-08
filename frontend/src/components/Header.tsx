'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store/store';
import { logout } from '@/store/slices/authSlice';
import { useMsal } from '@azure/msal-react';
import Link from 'next/link';
import Image from 'next/image';

interface MenuItem {
  name: string;
  href?: string;
  roles: string[];
  submenu?: SubMenuItem[];
}

interface SubMenuItem {
  name: string;
  href: string;
  roles: string[];
}

export default function Header() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { instance } = useMsal();
  const user = useSelector((state: RootState) => state.auth.user);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.relative')) {
        setActiveDropdown(null);
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleMouseEnter = (menuName: string) => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    setActiveDropdown(menuName);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

  const menuItems: MenuItem[] = [
    { name: 'Dashboard', href: '/dashboard', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
    { 
      name: 'Activity', 
      roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'],
      submenu: [
        { name: 'Sports & Games', href: '/sportgames', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] }
      ]
    },
    { 
      name: 'Events', 
      roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'],
      submenu: [
        { name: 'Events', href: '/events', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
        { name: 'Teams', href: '/teams', roles: ['super_admin', 'admin', 'captain', 'vicecaptain', 'player'] },
        { name: 'Players', href: '/players', roles: ['super_admin', 'admin', 'captain', 'vicecaptain'] }
      ]
    },
    { name: 'Fixtures', href: '/fixtures', roles: ['super_admin', 'admin', 'captain', 'vicecaptain'] },
    { name: 'Reports', href: '/reports', roles: ['super_admin', 'admin'] },
    { name: 'Roles', href: '/roles', roles: ['super_admin'] },
  ];

  const visibleMenuItems = menuItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-8">
          {/* Logo and Company Name */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/dashboard" className="flex items-center">
              <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                M
              </div>
              <span className="ml-3 text-xl font-semibold text-gray-900">MatchMaker Pro</span>
            </Link>
          </div>

          {/* Navigation Menu */}
          <nav className="hidden md:flex items-center space-x-1">
            {visibleMenuItems.map((item) => (
              <div 
                key={item.name} 
                className="relative"
                onMouseEnter={() => item.submenu && handleMouseEnter(item.name)}
                onMouseLeave={handleMouseLeave}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className="inline-flex items-center text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-md transition-all"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <button
                    className="inline-flex items-center text-gray-700 hover:text-indigo-600 hover:bg-gray-50 px-3 py-2 text-sm font-medium rounded-md transition-all"
                  >
                    {item.name}
                    <svg className="ml-1 h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
                
                {/* Dropdown Menu */}
                {item.submenu && activeDropdown === item.name && (
                  <div className="absolute left-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      {item.submenu
                        .filter(subItem => subItem.roles.includes(user?.role || ''))
                        .map((subItem) => (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                            onClick={() => setActiveDropdown(null)}
                          >
                            {subItem.name}
                          </Link>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-indigo-600 hover:bg-gray-100"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center text-sm rounded-md hover:bg-gray-50 px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-indigo-600 font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="ml-2 text-gray-700 font-medium hidden sm:block">{user?.name || 'User'}</span>
                <svg className="ml-1 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="origin-top-right absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                  <div className="py-1" role="menu">
                    <Link
                      href="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      My Profile
                    </Link>
                    <Link
                      href="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Settings
                    </Link>
                    <div className="border-t border-gray-100"></div>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="md:hidden px-4 pb-3">
          <nav className="space-y-1">
          {visibleMenuItems.map((item) => (
            <div key={item.name}>
              {item.href ? (
                <Link
                  href={item.href}
                  className="block text-gray-700 hover:text-indigo-600 py-2 text-base font-medium"
                >
                  {item.name}
                </Link>
              ) : (
                <>
                  <div className="text-gray-700 py-2 text-base font-medium">
                    {item.name}
                  </div>
                  {item.submenu && (
                    <div className="ml-4 space-y-1">
                      {item.submenu
                        .filter(subItem => subItem.roles.includes(user?.role || ''))
                        .map((subItem) => (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className="block text-gray-600 hover:text-indigo-600 py-1 text-sm"
                          >
                            {subItem.name}
                          </Link>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          </nav>
        </div>
      )}
    </header>
  );
}