import React from 'react';
import { Profile } from '../types';

interface HeaderProps {
  currentUser: Profile | null;
  onLogout: () => void;
}

const LogoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-blue-500">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <circle cx="11" cy="11" r="3"></circle>
        <line x1="11" y1="8" x2="11" y2="14"></line>
        <line x1="8.5" y1="9.5" x2="13.5" y2="12.5"></line>
        <line x1="8.5" y1="12.5" x2="13.5" y2="9.5"></line>
    </svg>
);


export const Header: React.FC<HeaderProps> = ({ currentUser, onLogout }) => {
  return (
    <header className="bg-white dark:bg-gray-800 shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <LogoIcon />
            <span className="text-xl font-bold text-gray-800 dark:text-white">Tour de Prior Art</span>
          </div>
          {currentUser && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <img className="h-8 w-8 rounded-full" src={currentUser.avatar_url ?? ''} alt={currentUser.name} />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:block">{currentUser.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full hidden sm:block">{currentUser.role}</span>
              </div>
              <button onClick={onLogout} className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
