
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
    has_correct_tier_one: boolean;
}

interface SubChallengeLeaderboardData {
    sub_challenge_title: string;
    leaderboard: LeaderboardEntry[];
    first_tier_one: string | null;
}

export const PublicSubChallengeLeaderboard: React.FC = () => {
    const { subChallengeId } = useParams<{ subChallengeId: string }>();
    const [leaderboardData, setLeaderboardData] = useState<SubChallengeLeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPublicLeaderboard = async () => {
            if (!subChallengeId) {
                setError("No sub-challenge ID provided.");
                setLoading(false);
                return;
            }
            setLoading(true);

            // Call the secure database function to get the leaderboard
            const { data, error } = await supabase.rpc('get_public_sub_challenge_leaderboard', {
                p_sub_challenge_id: subChallengeId
            });
            
            if (error) {
                setError("This sub-challenge may not exist or its results are not publicly available.");
                console.error('RPC Error:', error);
            } else if (data) {
                setLeaderboardData(data as SubChallengeLeaderboardData);
            }
            setLoading(false);
        };
        fetchPublicLeaderboard();
    }, [subChallengeId]);

    if (loading) return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900"><p className="text-gray-500">Loading leaderboard...</p></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4 bg-red-100 dark:bg-red-900"><Card><p className="text-red-700 dark:text-red-200">{error}</p></Card></div>;
    if (!leaderboardData || !leaderboardData.sub_challenge_title) return <div className="min-h-screen flex items-center justify-center p-4"><p>Sub-challenge not found.</p></div>;

    const { sub_challenge_title, leaderboard, first_tier_one } = leaderboardData;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <main className="w-full max-w-3xl">
                <Card>
                    <div className="text-center mb-6">
                        <div className="flex justify-center items-center gap-3">
                           <TrophyIcon />
                           <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{sub_challenge_title}</h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Public Leaderboard</p>
                    </div>

                    {first_tier_one && (
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg text-center">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                First Correct Tier-1 submitted by: <span className="font-bold">{first_tier_one}</span> 🎉
                            </p>
                        </div>
                    )}
                    
                    <div className="overflow-x-auto">
                         <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correct Tier-1</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {leaderboard.map(({ id, name, score, has_correct_tier_one }, index) => (
                                    <tr key={id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold">{index + 1}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {has_correct_tier_one ? (
                                                <span className="text-green-500">✔️ Yes</span>
                                            ) : (
                                                <span className="text-gray-500">❌ No</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold">{score} pts</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {leaderboard.length === 0 && (
                            <p className="text-center text-gray-500 py-6">No participants have evaluated submissions for this sub-challenge yet.</p>
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
