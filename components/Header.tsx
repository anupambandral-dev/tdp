import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  onLogout: () => void;
}

const LogoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-blue-500">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
);


export const Header: React.FC<HeaderProps> = ({ onLogout }) => {
  const { currentUser } = useAuth();
  
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
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{currentUser.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">{currentUser.role}</span>
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