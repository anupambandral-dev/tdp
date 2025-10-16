import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile, TrainingBatch, BatchParticipantWithProfile, Role } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { ManageParticipantsModal } from './ManageParticipantsModal';
import { ManageLevelClustersModal } from './ManageLevelClustersModal';

interface BatchDashboardProps {
    currentUser: Profile;
}

const levelData = [
    { id: 1, name: "Level 1: Sessions & Tasks", description: "Manage training sessions and evaluate post-session tasks.", icon: "📚" },
    { id: 2, name: "Level 2: Prelims Documents", description: "Evaluate preliminary document submissions from trainees.", icon: "📄" },
    { id: 3, name: "Level 3: Beehive Results", description: "Review and score results from the Beehive platform.", icon: "🐝" },
    { id: 4, name: "Level 4: Tour de Prior Art", description: "Administer and monitor prior art search challenges.", icon: "🏆" },
    { id: 5, name: "Level 5: Mentor Training", description: "Oversee the mentor training and evaluation process.", icon: "🧑‍🏫" },
    { id: "quiz", name: "Quizzes", description: "Create and manage real-time quizzes for this batch.", icon: "❓" },
];

// Helper component for clickable table headers, visible only to managers
const ThButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        <button onClick={onClick} className="w-full text-left hover:text-blue-600 dark:hover:text-blue-400 font-medium flex items-center gap-1">
            {children}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
    </th>
);

// Helper for static, non-clickable headers for other roles
const ThStatic: React.FC<{ children: React.ReactNode }> = ({ children }) => (
     <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{children}</th>
);


export const BatchDashboard: React.FC<BatchDashboardProps> = ({ currentUser }) => {
    const { batchId } = useParams<{ batchId: string }>();
    const [batch, setBatch] = useState<TrainingBatch | null>(null);
    const [participants, setParticipants] = useState<BatchParticipantWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'levels' | 'participants'>('levels');
    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
    const [editingLevel, setEditingLevel] = useState<string | null>(null);

    const isManager = currentUser.role === Role.MANAGER;

    const fetchBatchData = useCallback(async () => {
        if (!batchId) return;
        setLoading(true);
        setError(null);

        // Fetch the batch details itself
        const { data: batchData, error: batchError } = await supabase
            .from('training_batches')
            .select('*')
            .eq('id', batchId)
            .single();
        
        if (batchError) {
            setError(batchError.message);
            setLoading(false);
            return;
        }
        setBatch(batchData);

        // --- CONSOLIDATED PARTICIPANT FETCHING LOGIC ---

        // 1. Fetch participants explicitly added to the batch
        const { data: directParticipants, error: directParticipantsError } = await supabase
            .from('batch_participants')
            .select('*, profiles(*)')
            .eq('batch_id', batchId);

        if (directParticipantsError) {
            setError(directParticipantsError.message);
            setLoading(false);
            return;
        }

        // 2. Fetch challenges in the batch to find implicitly added participants (trainees)
        const { data: challenges, error: challengesError } = await supabase
            .from('overall_challenges')
            .select('trainee_ids')
            .eq('batch_id', batchId);

        if (challengesError) {
            setError(challengesError.message);
            setLoading(false);
            return;
        }

        // 3. Consolidate all participant IDs into a map to handle unique entries
        const participantMap = new Map<string, BatchParticipantWithProfile>();

        // Add direct participants to the map first
        (directParticipants as BatchParticipantWithProfile[]).forEach(p => {
            if (p.profiles) { // Ensure profile data exists
                participantMap.set(p.profiles.id, p);
            }
        });

        // Get all trainee IDs from all challenges, flatten the array, and make it unique
        const challengeTraineeIds = [...new Set(challenges?.flatMap(c => c.trainee_ids) || [])];

        // 4. Find which challenge trainees are NOT already in our map
        const newTraineeIdsToFetch = challengeTraineeIds.filter(id => !participantMap.has(id as string));

        // 5. If there are new trainees found only in challenges, fetch their profiles
        if (newTraineeIdsToFetch.length > 0) {
            const { data: newProfiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .in('id', newTraineeIdsToFetch);

            if (profilesError) {
                setError(profilesError.message);
            } else if (newProfiles) {
                // Add these new trainees to the map with placeholder batch_participant data
                (newProfiles as Profile[]).forEach(profile => {
                    participantMap.set(profile.id, {
                        id: `temp-${profile.id}`, // Placeholder for React key, DB will generate real one on save
                        batch_id: batchId,
                        participant_id: profile.id,
                        created_at: new Date().toISOString(),
                        overall_cluster: null,
                        overall_comments: null,
                        level_1_cluster: null,
                        level_1_comments: null,
                        level_2_cluster: null,
                        level_2_comments: null,
                        level_3_cluster: null,
                        level_3_comments: null,
                        level_4_cluster: null,
                        level_4_comments: null,
                        level_5_cluster: null,
                        level_5_comments: null,
                        profiles: profile,
                    });
                });
            }
        }

        // 6. Convert map back to an array, sort by name, and set state
        const allParticipants = Array.from(participantMap.values()).sort((a, b) => 
            a.profiles?.name.localeCompare(b.profiles?.name || '') || 0
        );
        
        setParticipants(allParticipants);
        setLoading(false);
    }, [batchId]);


    useEffect(() => {
        fetchBatchData();
    }, [fetchBatchData]);
    
    if (loading) return <div className="p-8">Loading batch dashboard...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!batch) return <div className="p-8 text-center">Training batch not found.</div>;

    const getLinkForLevel = (levelId: number | string) => {
        if (levelId === 'quiz') {
            return `/batch/${batchId}/quiz`;
        }
        return `/batch/${batchId}/level/${levelId}`;
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/batches" text="Back to All Batches" />
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                <h1 className="text-3xl font-bold">{batch.name}</h1>
                {isManager && <Button onClick={() => setIsParticipantsModalOpen(true)}>Manage Participants</Button>}
            </div>

            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('levels')} className={`${activeTab === 'levels' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Modules
                    </button>
                    <button onClick={() => setActiveTab('participants')} className={`${activeTab === 'participants' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                        Participants ({participants.length})
                    </button>
                </nav>
            </div>

            {activeTab === 'levels' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {levelData.map(level => (
                        <Link to={getLinkForLevel(level.id)} key={level.id} className="block transform hover:scale-105 transition-transform duration-200">
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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    {isManager ? <ThButton onClick={() => setEditingLevel('overall')}>Overall Cluster</ThButton> : <ThStatic>Overall Cluster</ThStatic>}
                                    {isManager ? <ThButton onClick={() => setEditingLevel('1')}>Lvl 1 Cluster</ThButton> : <ThStatic>Lvl 1 Cluster</ThStatic>}
                                    {isManager ? <ThButton onClick={() => setEditingLevel('2')}>Lvl 2 Cluster</ThButton> : <ThStatic>Lvl 2 Cluster</ThStatic>}
                                    {isManager ? <ThButton onClick={() => setEditingLevel('3')}>Lvl 3 Cluster</ThButton> : <ThStatic>Lvl 3 Cluster</ThStatic>}
                                    {isManager ? <ThButton onClick={() => setEditingLevel('4')}>Lvl 4 Cluster</ThButton> : <ThStatic>Lvl 4 Cluster</ThStatic>}
                                    {isManager ? <ThButton onClick={() => setEditingLevel('5')}>Lvl 5 Cluster</ThButton> : <ThStatic>Lvl 5 Cluster</ThStatic>}
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {participants.map(p => (
                                    <tr key={p.participant_id}>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <Link to={`/batch/${batchId}/participant/${p.participant_id}`} className="font-medium text-blue-600 hover:underline">
                                                {p.profiles?.name || 'Unknown User'}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{p.overall_cluster || 'N/A'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{p.level_1_cluster || 'N/A'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{p.level_2_cluster || 'N/A'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{p.level_3_cluster || 'N/A'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{p.level_4_cluster || 'N/A'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{p.level_5_cluster || 'N/A'}</td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {isManager && isParticipantsModalOpen && (
                <ManageParticipantsModal
                    batchId={batchId!}
                    existingParticipants={participants}
                    onClose={() => setIsParticipantsModalOpen(false)}
                    onSave={() => {
                        setIsParticipantsModalOpen(false);
                        fetchBatchData(); // Refresh data after save
                    }}
                />
            )}

            {isManager && editingLevel && (
                <ManageLevelClustersModal
                    batchId={batchId!}
                    levelId={editingLevel}
                    participants={participants}
                    onClose={() => setEditingLevel(null)}
                    onSave={() => {
                        setEditingLevel(null);
                        fetchBatchData(); // Refresh data after save
                    }}
                />
            )}
        </div>
    );
};