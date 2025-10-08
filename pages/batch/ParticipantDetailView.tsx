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

            if (batchInfoResult.error) {
                console.warn(batchInfoResult.error.message); // May not exist, not a hard error
            } else {
                setBatchInfo(batchInfoResult.data);
            }

            setLoading(false);
        };
        fetchData();
    }, [batchId, participantId]);

    if (loading) return <div className="p-8">Loading participant details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!participant) return <div className="p-8 text-center">Participant not found.</div>;

    const getLevelCluster = (level: number) => {
        if (!batchInfo) return 'N/A';
        const key = `level_${level}_cluster` as keyof BatchParticipant;
        return batchInfo[key] as string || 'N/A';
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={`/batch/${batchId}`} text="Back to Batch Dashboard" />

            <Card className="mb-8">
                <h1 className="text-3xl font-bold">{participant.name}</h1>
                <p className="text-gray-500 dark:text-gray-400">{participant.email}</p>
                <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <p><strong>Overall Cluster:</strong> {batchInfo?.overall_cluster || 'N/A'}</p>
                </div>
            </Card>

            <h2 className="text-2xl font-semibold mb-4">Performance by Level</h2>
            <div className="space-y-6">
                {Object.entries(levelNames).map(([level, name]) => (
                    <Card key={level}>
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xl font-semibold">{name}</h3>
                            <span className="text-sm font-medium bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full">
                                Cluster: {getLevelCluster(parseInt(level, 10))}
                            </span>
                        </div>
                        <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-gray-500">
                                {parseInt(level, 10) === 4 
                                 ? "Tour de Prior Art performance data will be shown here."
                                 : `Performance data for Level ${level} will be shown here.`
                                }
                            </p>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
