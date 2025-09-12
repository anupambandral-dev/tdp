
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card } from '../components/ui/Card';

const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-yellow-400"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);

interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
}

interface LeaderboardData {
    challenge_name: string;
    leaderboard: LeaderboardEntry[];
}

export const PublicLeaderboard: React.FC = () => {
    const { challengeId } = useParams<{ challengeId: string }>();
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPublicLeaderboard = async () => {
            if (!challengeId) {
                setError("No challenge ID provided.");
                setLoading(false);
                return;
            }
            setLoading(true);

            // Call the secure database function to get the leaderboard
            const { data, error } = await supabase.rpc('get_public_leaderboard', {
                p_challenge_id: challengeId
            });
            
            if (error) {
                setError("This challenge may not exist or is not publicly available.");
                console.error('RPC Error:', error);
            } else if (data) {
                setLeaderboardData(data as LeaderboardData);
            }
            setLoading(false);
        };
        fetchPublicLeaderboard();
    }, [challengeId]);
    
    const getMedal = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return null;
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900"><p className="text-gray-500">Loading leaderboard...</p></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4 bg-red-100 dark:bg-red-900"><Card><p className="text-red-700 dark:text-red-200">{error}</p></Card></div>;
    if (!leaderboardData || !leaderboardData.challenge_name) return <div className="min-h-screen flex items-center justify-center p-4"><p>Challenge not found.</p></div>;

    const { challenge_name, leaderboard } = leaderboardData;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <main className="w-full max-w-2xl">
                <Card>
                    <div className="text-center mb-6">
                        <div className="flex justify-center items-center gap-3">
                           <TrophyIcon />
                           <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{challenge_name}</h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Public Leaderboard</p>
                    </div>
                    
                    <div className="flow-root">
                        <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                            {leaderboard.map(({ id, name, score }, index) => (
                                <li key={id} className="py-3 sm:py-4">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0 w-8 text-center text-lg font-bold text-gray-500 dark:text-gray-400">
                                            {getMedal(index) || index + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate dark:text-white">
                                                {name}
                                            </p>
                                        </div>
                                        <div className="inline-flex items-center text-base font-semibold text-gray-900 dark:text-white">
                                            {score} pts
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                         {leaderboard.length === 0 && (
                            <p className="text-center text-gray-500 py-6">No participants have submitted evaluated work yet.</p>
                        )}
                    </div>
                </Card>
                 <footer className="text-center mt-4">
                    <p className="text-xs text-gray-500">Tour de Prior Art</p>
                </footer>
            </main>
        </div>
    );
};
