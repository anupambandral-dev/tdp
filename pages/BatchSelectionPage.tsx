import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Profile, TrainingBatch } from '../types';
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
            const { data, error } = await supabase
                .from('training_batches')
                .select('*')
                .contains('manager_ids', [currentUser.id])
                .order('created_at', { ascending: false });

            if (error) {
                setError(error.message);
                console.error("Error fetching batches:", error);
            } else {
                setBatches(data);
            }
            setLoading(false);
        };
        fetchBatches();
    }, [currentUser.id]);

    const handleCreateBatch = async () => {
        const batchName = prompt("Enter a name for the new training batch:");
        if (batchName) {
            setLoading(true);
            const { data, error } = await supabase
                .from('training_batches')
                .insert({ name: batchName, manager_ids: [currentUser.id] })
                .select()
                .single();
            
            if (error) {
                alert(`Error creating batch: ${error.message}`);
            } else if (data) {
                navigate(`/batch/${data.id}`);
            }
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Training Batches</h1>
                <Button onClick={handleCreateBatch} disabled={loading}>
                    <PlusIcon /> Create New Batch
                </Button>
            </div>

            {loading && <p>Loading batches...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}
            
            {!loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {batches.map(batch => (
                        <Link to={`/batch/${batch.id}`} key={batch.id} className="block">
                             <Card className="h-full hover:shadow-xl transition-shadow duration-200">
                                <h2 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{batch.name}</h2>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                    Created on {new Date(batch.created_at).toLocaleDateString()}
                                </p>
                            </Card>
                        </Link>
                    ))}
                     {batches.length === 0 && (
                        <div className="col-span-full">
                            <Card className="text-center py-10">
                                <p className="text-gray-500">You have not created or been assigned to any training batches.</p>
                            </Card>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
