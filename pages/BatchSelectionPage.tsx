import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Profile, Role, TrainingBatch } from '../types';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

interface BatchSelectionPageProps {
    currentUser: Profile;
}

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

export const BatchSelectionPage: React.FC<BatchSelectionPageProps> = ({ currentUser }) => {
    const [batches, setBatches] = useState<TrainingBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchBatches = async () => {
            setLoading(true);
            setError(null);

            let finalBatches: TrainingBatch[] = [];

            if (currentUser.role === Role.MANAGER) {
                const { data, error } = await supabase
                    .from('training_batches')
                    .select('*')
                    .contains('manager_ids', [currentUser.id])
                    .order('created_at', { ascending: false });
                
                if (error) {
                    setError(error.message);
                    setLoading(false);
                    return;
                }
                finalBatches = data || [];

            } else { // Trainee or Evaluator
                const batchMap = new Map<string, TrainingBatch>();

                // 1. All non-managers find batches they are participants of
                const { data: participantData, error: participantError } = await supabase
                    .from('batch_participants')
                    .select('training_batches!inner(*)')
                    .eq('participant_id', currentUser.id);
                
                if (participantError) {
                    setError(participantError.message);
                    setLoading(false);
                    return;
                }

                const participantBatches = participantData ? participantData.map(p => p.training_batches).filter(Boolean) as TrainingBatch[] : [];
                participantBatches.forEach(b => b && batchMap.set(b.id, b));
                
                // 2. Evaluators ALSO find batches where they are assigned to a sub-challenge
                // This ensures evaluators see batches they are assigned to evaluate in, even if not explicitly a "participant".
                if (currentUser.role === Role.EVALUATOR) {
                    const { data: subChallenges, error: scError } = await supabase
                        .from('sub_challenges')
                        .select('overall_challenges(training_batches(*))')
                        .contains('evaluator_ids', [currentUser.id]);
                    
                    if (scError) {
                        setError(scError.message);
                        setLoading(false);
                        return;
                    }

                    if (subChallenges) {
                        subChallenges.forEach(sc => {
                            // The result of the join is nested.
                            const batch = sc.overall_challenges?.training_batches;
                            // The joined result might be null or an array if the relationship isn't one-to-one, so we check.
                            if (batch && !Array.isArray(batch)) {
                                 batchMap.set(batch.id, batch);
                            }
                        });
                    }
                }
                
                finalBatches = Array.from(batchMap.values());
                finalBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            }

            // Auto-redirect logic for non-managers with exactly one batch.
            // This is a UX improvement to skip the selection screen.
            if (currentUser.role !== Role.MANAGER && finalBatches.length === 1) {
                const batchId = finalBatches[0].id;
                // The default path is to the Level 4 (Tour de Prior Art) module for the user's role.
                const rolePath = currentUser.role === Role.TRAINEE ? 'trainee' : 'evaluator';
                navigate(`/batch/${batchId}/level/4/${rolePath}`);
                return; // Skip setting state as we are redirecting
            }
            
            setBatches(finalBatches);
            setLoading(false);
        };

        fetchBatches();
    }, [currentUser, navigate]);
    
    const getParticipantLink = (batchId: string) => {
        const rolePath = currentUser.role === Role.TRAINEE ? 'trainee' : 'evaluator';
        return `/batch/${batchId}/level/4/${rolePath}`;
    }

    if (loading) {
        return (
            <div className="container mx-auto p-8 text-center">
                <p>Loading your assignments...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-8 text-center">
                <p className="text-red-500">Error: {error}</p>
            </div>
        );
    }

    const isManager = currentUser.role === Role.MANAGER;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">{isManager ? "Training Batches" : "Your Assigned Batches"}</h1>
                {isManager && (
                    <Link to="/create-batch">
                        <Button disabled={loading}>
                            <PlusIcon /> Create New Batch
                        </Button>
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {batches.map(batch => (
                    <Link to={isManager ? `/batch/${batch.id}` : getParticipantLink(batch.id)} key={batch.id} className="block">
                         <Card className="h-full hover:shadow-xl transition-shadow duration-200">
                            <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{batch.name}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                Created on {new Date(batch.created_at).toLocaleDateString()}
                            </p>
                        </Card>
                    </Link>
                ))}
            </div>

            {batches.length === 0 && (
                <div className="col-span-full">
                    <Card className="text-center py-10">
                        <p className="text-gray-500">
                            {isManager
                                ? "You have not created or been assigned to any training batches."
                                : "You have not been assigned to a training batch yet. Please contact your manager."
                            }
                        </p>
                    </Card>
                </div>
            )}
        </div>
    );
};
