import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { Profile, BatchParticipantWithProfile } from '../../types';
import { Button } from '../../components/ui/Button';
import { TablesInsert } from '../../database.types';

interface ManageParticipantsModalProps {
    batchId: string;
    existingParticipants: BatchParticipantWithProfile[];
    onClose: () => void;
    onSave: () => void;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-gray-500 hover:text-red-500"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path></svg>
);


export const ManageParticipantsModal: React.FC<ManageParticipantsModalProps> = ({ batchId, existingParticipants, onClose, onSave }) => {
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [participants, setParticipants] = useState<BatchParticipantWithProfile[]>(existingParticipants);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchProfiles = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('profiles').select('*').order('name');
            if (data) {
                setAllProfiles(data as unknown as Profile[]);
            }
            if (error) {
                console.error(error);
            }
            setLoading(false);
        };
        fetchProfiles();
    }, []);

    const handleAddParticipant = (profile: Profile) => {
        if (participants.some(p => p.participant_id === profile.id)) return; // Already exists

        const newParticipant: BatchParticipantWithProfile = {
            id: `new-${profile.id}`, // temp ID for react key
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
        };
        setParticipants([...participants, newParticipant]);
        setSearchTerm(''); // Clear search
    };
    
    const handleRemoveParticipant = (participantId: string) => {
        setParticipants(participants.filter(p => p.participant_id !== participantId));
    };

    const handleSaveChanges = async () => {
        setSaving(true);

        const originalParticipantIds = new Set(existingParticipants.map(p => p.participant_id));
        const currentParticipantIds = new Set(participants.map(p => p.participant_id));

        const addedIds = [...currentParticipantIds].filter(id => !originalParticipantIds.has(id));
        const removedIds = [...originalParticipantIds].filter(id => !currentParticipantIds.has(id));

        const promises = [];

        // Handle removals
        if (removedIds.length > 0) {
            promises.push(
                supabase
                    .from('batch_participants')
                    .delete()
                    .eq('batch_id', batchId)
                    .in('participant_id', removedIds)
            );
        }

        // Handle additions
        if (addedIds.length > 0) {
            // FIX: Removed explicit type annotation that was causing a TypeScript inference issue,
            // resulting in participant_id being typed as 'unknown'. Type inference now correctly
            // handles the object shape for the Supabase client.
            const addedParticipantsData = addedIds.map(id => ({
                batch_id: batchId,
                participant_id: id,
            }));
            promises.push(
                supabase.from('batch_participants').insert(addedParticipantsData)
            );
        }
        
        const results = await Promise.all(promises);
        const errorResult = results.find(res => res.error);

        if (errorResult) {
            alert(`Error saving changes: ${errorResult.error?.message}`);
        } else {
            onSave();
        }
        setSaving(false);
    };

    const filteredProfiles = searchTerm
        ? allProfiles.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
            !participants.some(sp => sp.participant_id === p.id)
          )
        : [];
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold">Manage Batch Participants</h2>
                </div>

                <div className="p-4 flex-grow overflow-y-auto">
                    <div className="relative mb-4">
                        <input
                            type="text"
                            placeholder="Search by name to add..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
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
                                    <li className="p-2 text-gray-500">No new users found.</li>
                                 )
                                }
                            </ul>
                        )}
                    </div>
                    
                    <h3 className="text-sm font-medium mb-2">{participants.length} Participant(s) in this batch</h3>
                    <div className="border rounded-md max-h-80 overflow-y-auto p-2 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                        {participants.length > 0 ? (
                            participants.map(p => (
                                <div key={p.participant_id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded shadow-sm">
                                    <div>
                                        <p className="font-medium text-sm">{p.profiles?.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.profiles?.email}</p>
                                    </div>
                                    <button type="button" onClick={() => handleRemoveParticipant(p.participant_id)} aria-label={`Remove ${p.profiles?.name}`}>
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 p-4">No participants added yet.</p>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t dark:border-gray-700 flex justify-end space-x-2">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSaveChanges} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
};