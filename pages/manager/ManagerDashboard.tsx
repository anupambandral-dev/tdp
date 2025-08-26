

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile, OverallChallenge } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface ManagerDashboardProps {
  currentUser: Profile;
}

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const UsersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
);

const UserPlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
);

const ClipboardCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12l2 2 4-4"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
);

const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);

interface ChallengeWithCounts extends OverallChallenge {
    sub_challenges_count: number;
}
interface ChallengeWithSubChallengeCount extends OverallChallenge {
    sub_challenges: { count: number }[];
}


export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({ currentUser }) => {
  const [challenges, setChallenges] = useState<ChallengeWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChallenges = async () => {
      const { data, error } = await supabase
        .from('overall_challenges')
        .select('*, sub_challenges(count)');
        
      if (error) {
        setError(error.message);
        console.error('Error fetching challenges:', error);
      } else if (data) {
        const typedData = data as unknown as ChallengeWithSubChallengeCount[];
        const formattedData = typedData.map(d => ({
            ...d,
            sub_challenges_count: d.sub_challenges[0]?.count ?? 0
        }))
        setChallenges(formattedData);
      }
    };

    const initialFetch = async () => {
        setLoading(true);
        await fetchChallenges();
        setLoading(false);
    }
    
    initialFetch();

    // Set up real-time subscription
    const channel = supabase
      .channel('manager-dashboard-challenges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'overall_challenges' },
        (payload) => {
          console.log('Change received on overall_challenges!', payload);
          // Re-fetch without setting loading state to avoid UI flicker
          fetchChallenges(); 
        }
      )
      .subscribe();

    // Cleanup subscription on component unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser.id]);
  
  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
            <h1 className="text-3xl font-bold">Manager Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">Welcome back, {currentUser.name}!</p>
        </div>
        <div className="flex items-center space-x-2 flex-wrap gap-2">
            <Link to="/evaluator">
                <Button variant="secondary"><ClipboardCheckIcon />Evaluation Queue</Button>
            </Link>
            <Link to="/manager/users">
                <Button variant="secondary"><UserPlusIcon />User Management</Button>
            </Link>
            <Link to="/manager/create-challenge">
                <Button><PlusIcon />Create New Challenge</Button>
            </Link>
        </div>
      </div>

      {loading && <p>Loading challenges...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}
      
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {challenges.map((challenge) => (
            <Card key={challenge.id} className="hover:shadow-lg transition-shadow duration-200 relative">
              {challenge.ended_at && (
                  <span className="absolute top-2 right-2 px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                      Ended
                  </span>
              )}
              <div className="flex flex-col h-full">
                <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{challenge.name}</h2>
                <div className="flex-grow mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div className="flex items-center">
                    <CalendarIcon />
                    <span>{challenge.sub_challenges_count} Sub-challenges</span>
                  </div>
                  <div className="flex items-center">
                    <UsersIcon />
                    <span>{challenge.trainee_ids.length} Participants</span>
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t dark:border-gray-700">
                  <Link to={`/manager/challenge/${challenge.id}`}>
                    <Button className="w-full">View Details</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};