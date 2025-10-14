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
            
            const batchMap = new Map<string, TrainingBatch>();

            // 1. Batches where user is a participant (covers Trainees, and Evaluators/Managers added as participants)
            const { data: participantData, error: participantError } = await supabase
                .from('batch_participants')
                .select('training_batches!inner(*)')
                .eq('participant_id', currentUser.id);

            if (participantError) {
                setError(participantError.message);
                setLoading(false);
                return;
            }
            participantData?.forEach(p => p.training_batches && batchMap.set(p.training_batches.id, p.training_batches));

            // 2. Batches where user is an explicit evaluator on a sub-challenge
            const { data: evaluatorData, error: evaluatorError } = await supabase
                .from('sub_challenges')
                .select('overall_challenges!inner(training_batches!inner(*))')
                .contains('evaluator_ids', [currentUser.id]);

            if (evaluatorError) {
                setError(evaluatorError.message);
                setLoading(false);
                return;
            }
            evaluatorData?.forEach(sc => {
                const batch = sc.overall_challenges?.training_batches;
                if (batch && !Array.isArray(batch)) {
                    batchMap.set(batch.id, batch);
                }
            });

            // 3. Additional logic for Managers
            if (currentUser.role === Role.MANAGER) {
                // 3a. Batches they manage directly
                const { data: managedBatches, error: managedBatchesError } = await supabase
                    .from('training_batches')
                    .select('*')
                    .contains('manager_ids', [currentUser.id]);
                
                if (managedBatchesError) {
                    setError(managedBatchesError.message);
                    setLoading(false);
                    return;
                }
                managedBatches?.forEach(b => batchMap.set(b.id, b));

                // 3b. Batches containing overall challenges they manage
                const { data: ocManagedBatches, error: ocManagedError } = await supabase
                    .from('overall_challenges')
                    .select('training_batches!inner(*)')
                    .contains('manager_ids', [currentUser.id]);
                
                if (ocManagedError) {
                    setError(ocManagedError.message);
                    setLoading(false);
                    return;
                }
                ocManagedBatches?.forEach(oc => {
                    const batch = oc.training_batches;
                    if (batch && !Array.isArray(batch)) {
                        batchMap.set(batch.id, batch);
                    }
                });
            }
            
            const finalBatches = Array.from(batchMap.values());
            finalBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Auto-redirect for non-managers with exactly one batch to improve UX.
            if (currentUser.role !== Role.MANAGER && finalBatches.length === 1) {
                const batchId = finalBatches[0].id;
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
