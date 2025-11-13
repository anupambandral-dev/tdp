import React, { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, BatchParticipant, BatchParticipantWithProfile, Role } from '../../types';
import { BackButton } from '../../components/ui/BackButton';
import { Card } from '../../components/ui/Card';
import { ManagerDashboard } from '../manager/ManagerDashboard';
import { TraineeDashboard } from '../trainee/TraineeDashboard';

const levelData: { [key: string]: { name: string; description: string } } = {
    "1": { name: "Level 1: Sessions & Tasks", description: "Manage training sessions and evaluate post-session tasks." },
    "2": { name: "Level 2: Prelims Documents", description: "Evaluate preliminary document submissions from trainees." },
    "3": { name: "Level 3: Beehive Results", description: "Review and score results from the Beehive platform." },
    "4": { name: "Level 4: Tour de Prior Art", description: "Administer and monitor prior art search challenges." },
    "5": { name: "Level 5: Mentor Training", description: "Oversee the mentor training and evaluation process." },
};

const LevelPlaceholder: React.FC<{ levelId: string; participants: BatchParticipantWithProfile[] }> = ({ levelId, participants }) => (
    <>
        <h2 className="text-2xl font-semibold mb-4">Participant Overview</h2>
        <Card>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cluster</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Performance</th>
                        </tr>
                    </thead>
                     <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {participants.map(p => {
                             const clusterKey = `level_${levelId}_cluster` as keyof BatchParticipant;
                             const cluster = p[clusterKey] as string || 'N/A';
                            return (
                                <tr key={p.id}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium">{p.profiles?.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{cluster}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">Coming Soon</td>
                                </tr>
                            )
                        })}
                     </tbody>
                </table>
            </div>
        </Card>
    </>
);


export const LevelDetailView: React.FC<{ currentUser: Profile }> = ({ currentUser }) => {
    const { batchId, levelId } = useParams<{ batchId: string; levelId: string }>();
    const [participants, setParticipants] = useState<BatchParticipantWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchParticipants = async () => {
            if (!batchId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('batch_participants')
                .select('*, profiles(*)')
                .eq('batch_id', batchId!);
            
            if (error) {
                setError(error.message);
            } else {
                setParticipants(data as unknown as BatchParticipantWithProfile[]);
            }
            setLoading(false);
        };
        fetchParticipants();
    }, [batchId]);

    if (!levelId || !levelData[levelId]) {
        return <Navigate to={`/batch/${batchId}`} replace />;
    }

    const level = levelData[levelId];
    
    // Trainee view redirects to their specific dashboard
    if (currentUser.role === Role.TRAINEE) {
        if (levelId === '4') {
            return <TraineeDashboard currentUser={currentUser} />;
        }
        // For other levels, a trainee might have a different view in the future
        return (
             <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <BackButton to={`/batch/${batchId}`} text="Back to Batch Dashboard" />
                <h1 className="text-3xl font-bold mb-2">{level.name}</h1>
                 <Card className="mt-8 text-center py-10">
                    <p className="text-gray-500 dark:text-gray-400">This training level is not yet available.</p>
                </Card>
            </div>
        )
    }

    // Manager view
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={`/batch/${batchId}`} text="Back to Batch Dashboard" />
            <h1 className="text-3xl font-bold mb-2">{level.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-8">{level.description}</p>

            {loading ? <p>Loading participants...</p> : 
             error ? <p className="text-red-500">Error: {error}</p> :
             (
                <>
                    {levelId === '4' ? (
                        <ManagerDashboard currentUser={currentUser} />
                    ) : (
                        <LevelPlaceholder levelId={levelId} participants={participants} />
                    )}
                </>
             )
            }
        </div>
    );
};
