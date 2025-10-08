import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, TrainingBatch, BatchParticipantWithProfile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { ManageParticipantsModal } from './ManageParticipantsModal';

interface BatchDashboardProps {
    currentUser: Profile;
}

const levelData = [
    { id: 1, name: "Level 1: Sessions & Tasks", description: "Manage training sessions and evaluate post-session tasks.", icon: "📚" },
    { id: 2, name: "Level 2: Prelims Documents", description: "Evaluate preliminary document submissions from trainees.", icon: "📄" },
    { id: 3, name: "Level 3: Beehive Results", description: "Review and score results from the Beehive platform.", icon: "🐝" },
    { id: 4, name: "Level 4: Tour de Prior Art", description: "Administer and monitor prior art search challenges.", icon: "🏆" },
    { id: 5, name: "Level 5: Mentor Training", description: "Oversee the mentor training and evaluation process.", icon: "🧑‍🏫" },
];

export const BatchDashboard: React.FC<BatchDashboardProps> = ({ currentUser }) => {
    const { batchId } = useParams<{ batchId: string }>();
    const [batch, setBatch] = useState<TrainingBatch | null>(null);
    const [participants, setParticipants] = useState<BatchParticipantWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'participants' | 'levels'>('levels');
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchBatchData = useCallback(async () => {
        if (!batchId) return;
        setLoading(true);

        const batchPromise = supabase.from('training_batches').select('*').eq('id', batchId).single();
        const participantsPromise = supabase.from('batch_participants').select('*, profiles(*)').eq('batch_id', batchId);

        const [batchResult, participantsResult] = await Promise.all([batchPromise, participantsPromise]);

        if (batchResult.error) {
            setError(batchResult.error.message);
        } else {
            setBatch(batchResult.data);
        }

        if (participantsResult.error) {
            setError(participantsResult.error.message);
        } else {
            setParticipants(participantsResult.data as BatchParticipantWithProfile[]);
        }

        setLoading(false);
    }, [batchId]);

    useEffect(() => {
        fetchBatchData();
    }, [fetchBatchData]);
    
    if (loading) return <div className="p-8">Loading batch dashboard...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!batch) return <div className="p-8 text-center">Training batch not found.</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/batches" text="Back to All Batches" />
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-3xl font-bold">{batch.name}</h1>
                <Button onClick={() => setIsModalOpen(true)}>Manage Participants & Clusters</Button>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('levels')} className={`${activeTab === 'levels' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Levels
                    </button>
                    <button onClick={() => setActiveTab('participants')} className={`${activeTab === 'participants' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Participants ({participants.length})
                    </button>
                </nav>
            </div>

            {activeTab === 'levels' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {levelData.map(level => (
                        <Link to={`/batch/${batchId}/level/${level.id}`} key={level.id} className="block transform hover:scale-105 transition-transform duration-200">
                             <Card className="h-full flex flex-col">
                                <div className="text-5xl mb-4">{level.icon}</div>
                                <h2 className="text-xl font-bold">{level.name}</h2>
                                <p className="text-gray-600 dark:text-gray-400 mt-2 flex-grow">{level.description}</p>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}

            {activeTab === 'participants' && (
                <Card>
                     <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall Cluster</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level 4 Cluster</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {participants.map(p => (
                                    <tr key={p.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <Link to={`/batch/${batchId}/participant/${p.participant_id}`} className="font-medium text-blue-600 hover:underline">
                                                {p.profiles?.name || 'Unknown User'}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">{p.overall_cluster || 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{p.level_4_cluster || 'N/A'}</td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {isModalOpen && (
                <ManageParticipantsModal
                    batchId={batchId!}
                    existingParticipants={participants}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => {
                        setIsModalOpen(false);
                        fetchBatchData(); // Refresh data after save
                    }}
                />
            )}
        </div>
    );
};
