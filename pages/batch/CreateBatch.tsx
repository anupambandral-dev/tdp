import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Profile } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';

interface CreateBatchProps {
    currentUser: Profile;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path></svg>
);

export const CreateBatch: React.FC<CreateBatchProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [batchName, setBatchName] = useState('');
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [selectedParticipants, setSelectedParticipants] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchProfiles = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('profiles').select('*').order('name');
            if (data) {
                // FIX: Cast Supabase response data to the expected Profile[] type.
                setAllProfiles(data as unknown as Profile[]);
            }
            if (error) {
                console.error("Error fetching profiles:", error);
                alert("Could not load user list.");
            }
            setLoading(false);
        };
        fetchProfiles();
    }, []);

    const handleAddParticipant = (profile: Profile) => {
        if (!selectedParticipants.some(p => p.id === profile.id)) {
            setSelectedParticipants([...selectedParticipants, profile]);
        }
        setSearchTerm(''); // Clear search after selection
    };

    const handleRemoveParticipant = (profileId: string) => {
        setSelectedParticipants(selectedParticipants.filter(p => p.id !== profileId));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!batchName.trim()) {
            alert('Please provide a batch name.');
            return;
        }

        setSaving(true);
        // Step 1: Create the new training batch
        // FIX: The .insert() method expects an array of objects.
        const { data: newBatch, error: batchError } = await supabase
            .from('training_batches')
            .insert([{
                name: batchName,
                manager_ids: [currentUser.id]
            }])
            .select()
            .single();

        if (batchError || !newBatch) {
            alert(`Error creating batch: ${batchError?.message}`);
            setSaving(false);
            return;
        }

        // Step 2: If participants were selected, add them to the batch
        if (selectedParticipants.length > 0) {
            const participantsData = selectedParticipants.map(p => ({
                batch_id: newBatch.id,
                participant_id: p.id
            }));

            const { error: participantsError } = await supabase
                .from('batch_participants')
                .insert(participantsData);

            if (participantsError) {
                alert(`Batch was created, but failed to add participants: ${participantsError.message}`);
                // Navigate to the batch anyway, as it was created.
                navigate(`/batch/${newBatch.id}`);
                return;
            }
        }

        // Step 3: Success, navigate to the new batch dashboard
        navigate(`/batch/${newBatch.id}`);
    };

    const filteredProfiles = searchTerm
        ? allProfiles.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !selectedParticipants.some(sp => sp.id === p.id)
        )
        : [];

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to="/batches" text="Back to All Batches" />
            <Card>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <h1 className="text-3xl font-bold">Create New Training Batch</h1>

                    <div>
                        <label htmlFor="batchName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Batch Name</label>
                        <input
                            type="text"
                            id="batchName"
                            value={batchName}
                            onChange={(e) => setBatchName(e.target.value)}
                            placeholder="e.g., August 2024 Cohort"
                            required
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                        />
                    </div>

                    <div>
                        <label htmlFor="search-profiles" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Add Participants</label>
                         <div className="relative">
                            <input
                                id="search-profiles"
                                type="text"
                                placeholder="Search by name to add..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                            />
                            {searchTerm && (
                                <ul className="absolute z-10 w-full bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
                                    {loading ? <li className="p-2">Loading...</li> : 
                                     filteredProfiles.length > 0 ? (
                                        filteredProfiles.map(p => (
                                            <li key={p.id} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" onClick={() => handleAddParticipant(p)}>
                                                {p.name} ({p.email})
                                            </li>
                                        ))
                                     ) : (
                                        <li className="p-2 text-gray-500">No users found.</li>
                                     )
                                    }
                                </ul>
                            )}
                        </div>

                        <div className="mt-4">
                            <h3 className="text-sm font-medium">{selectedParticipants.length} Participant(s) selected</h3>
                            <div className="mt-2 border rounded-md max-h-60 overflow-y-auto p-2 space-y-2 bg-gray-50 dark:bg-gray-800">
                                {selectedParticipants.length > 0 ? (
                                    selectedParticipants.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded shadow-sm">
                                            <div>
                                                <p className="font-medium text-sm">{p.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{p.email}</p>
                                            </div>
                                            <button type="button" onClick={() => handleRemoveParticipant(p.id)} aria-label={`Remove ${p.name}`}>
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 p-4">No participants added yet.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                        <Button type="button" variant="secondary" onClick={() => navigate('/batches')} disabled={saving}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || loading}>
                            {saving ? 'Creating...' : 'Create Batch'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
