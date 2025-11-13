


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

type ParticipantBatch = { batch_id: string; training_batches: TrainingBatch };

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
            let fetchError: string | null = null;
    
            if (currentUser.role === Role.MANAGER) {
                const { data, error } = await supabase
                    .from('training_batches')
                    .select('*')
                    .contains('manager_ids', [currentUser.id])
                    .order('created_at', { ascending: false });
                
                if (error) fetchError = error.message;
                else finalBatches = data || [];
    
            } else if (currentUser.role === Role.EVALUATOR) {
                const { data, error } = await supabase.rpc('get_my_evaluator_batches');
                
                if (error) {
                    fetchError = error.message;
                    console.error("RPC error fetching evaluator batches:", error);
                } else {
                    // FIX: Safely cast RPC response to the expected type.
                    finalBatches = ((data as unknown as TrainingBatch[]) || []).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
            } else { // Role.TRAINEE or other participant roles
                const { data, error } = await supabase.rpc('get_my_participant_batches');
                
                if (error) {
                    fetchError = error.message;
                    console.error("RPC error fetching participant batches:", error);
                } else {
                    // FIX: Safely cast RPC response to the expected type.
                    finalBatches = ((data as unknown as TrainingBatch[]) || []).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                }
            }
            
            if (fetchError) {
                setError(fetchError);
                setLoading(false);
                return;
            }
    
            // Auto-redirect if user has exactly one batch and is not a manager
            if (finalBatches.length === 1 && currentUser.role !== Role.MANAGER) {
                const batchId = finalBatches[0].id;
                const rolePath = currentUser.role === Role.TRAINEE ? 'trainee' : 'evaluator';
                // Hardcoded to level 4 as per existing logic in the app
                navigate(`/batch/${batchId}/level/4/${rolePath}`, { replace: true });
                return; // Don't proceed to set state, as we are navigating away
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
                        <p className="text-gray-500 dark:text-gray-400">
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
