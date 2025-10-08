import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Profile } from '../types';

interface MainDashboardProps {
  currentUser: Profile;
}

const TourIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-blue-500 mb-4">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
);

const QuizIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-purple-500 mb-4">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </svg>
);

export const MainDashboard: React.FC<MainDashboardProps> = ({ currentUser }) => {
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center mb-12">
            <h1 className="text-4xl font-bold">Welcome, {currentUser.name}!</h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Please select a module to continue.</p>
        </div>
      
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            <Link to="/tour-de-prior-art" className="block transform hover:scale-105 transition-transform duration-200">
                <Card className="h-full flex flex-col items-center justify-center text-center p-8">
                    <TourIcon />
                    <h2 className="text-2xl font-bold">Tour de Prior Art</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Engage in prior art search challenges, submit your findings, and climb the leaderboard.</p>
                </Card>
            </Link>

            <Link to="/quiz" className="block transform hover:scale-105 transition-transform duration-200">
                <Card className="h-full flex flex-col items-center justify-center text-center p-8">
                    <QuizIcon />
                    <h2 className="text-2xl font-bold">Quiz Section</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Test your knowledge with our collection of quizzes. Coming soon!</p>
                </Card>
            </Link>
        </div>
    </div>
  );
};
