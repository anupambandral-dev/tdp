import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, BatchParticipant } from '../../types';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';

const levelNames: { [key: number]: string } = {
    1: "Level 1: Sessions & Tasks",
    2: "Level 2: Prelims Documents",
    3: "Level 3: Beehive Results",
    4: "Level 4: Tour de Prior Art",
    5: "Level 5: Mentor Training",
};

export const ParticipantDetailView: React.FC = () => {
    const { batchId, participantId } = useParams<{ batchId: string; participantId: string }>();
    const [participant, setParticipant] = useState<Profile | null>(null);
    const [batchInfo, setBatchInfo] = useState<BatchParticipant | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!batchId || !participantId) return;
            setLoading(true);

            const profilePromise = supabase.from('profiles').select('*').eq('id', participantId).single();
            const batchInfoPromise = supabase.from('batch_participants').select('*').eq('batch_id', batchId).eq('participant_id', participantId).single();

            const [profileResult, batchInfoResult] = await Promise.all([profilePromise, batchInfoPromise]);

            if (profileResult.error) {
                setError(profileResult.error.message);
            } else {
                setParticipant(profileResult.data as Profile);
            }

            if (batchInfoResult.error && batchInfoResult.error.code !== 'PGRST116') {
                // If the user is only a challenge participant, they might not have a batch_participants entry yet.
                // This is not a fatal error for this view.
                console.warn(batchInfoResult.error.message);
            } else {
                setBatchInfo(batchInfoResult.data as BatchParticipant);
            }

            setLoading(false);
        };
        fetchData();
    }, [batchId, participantId]);

    if (loading) return <div className="p-8">Loading participant details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!participant) return <div className="p-8 text-center">Participant not found.</div>;

    const getLevelData = (level: number | 'overall') => {
        if (!batchInfo) return { cluster: 'N/A', comments: null };
        
        const clusterKey = level === 'overall' ? 'overall_cluster' : `level_${level}_cluster`;
        const commentsKey = level === 'overall' ? 'overall_comments' : `level_${level}_comments`;
        
        return {
            cluster: batchInfo[clusterKey as keyof BatchParticipant] as string || 'N/A',
            comments: batchInfo[commentsKey as keyof BatchParticipant] as string | null
        };
    };

    const overallData = getLevelData('overall');

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={`/batch/${batchId}`} text="Back to Batch Dashboard" />

            <Card className="mb-8">
                <h1 className="text-3xl font-bold">{participant.name}</h1>
                <p className="text-gray-500 dark:text-gray-400">{participant.email}</p>
                <div className="mt-4 pt-4 border-t dark:border-gray-700 space-y-2">
                    <p><strong>Overall Cluster:</strong> {overallData.cluster}</p>
                    {overallData.comments && (
                        <div>
                           <p className="text-sm"><strong>Overall Comments:</strong></p>
                           <p className="text-sm text-gray-600 dark:text-gray-400">{overallData.comments}</p>
                        </div>
                    )}
                </div>
            </Card>

            <h2 className="text-2xl font-semibold mb-4">Performance by Level</h2>
            <div className="space-y-6">
                {Object.entries(levelNames).map(([levelStr, name]) => {
                    const level = parseInt(levelStr, 10);
                    const levelData = getLevelData(level);
                    return (
                        <Card key={level}>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-semibold">{name}</h3>
                                <span className="text-sm font-medium bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full">
                                    Cluster: {levelData.cluster}
                                </span>
                            </div>
                            
                            {levelData.comments && (
                                <div className="mb-4">
                                    <p className="text-sm font-semibold">Manager Comments:</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-900/50 p-2 rounded-md">{levelData.comments}</p>
                                </div>
                            )}

                            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <p className="text-gray-500">
                                    {level === 4 
                                     ? "Tour de Prior Art performance data will be shown here."
                                     : `Performance data for Level ${level} will be shown here.`
                                    }
                                </p>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};
