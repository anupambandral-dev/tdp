import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { BatchParticipantWithProfile } from '../../types';
import { Button } from '../../components/ui/Button';

// Define a type for the updates we're tracking
type ParticipantUpdate = {
    participant_id: string;
    cluster: string | null;
    comments: string | null;
};

interface ManageLevelClustersModalProps {
    batchId: string;
    levelId: string; // 'overall' or '1', '2', etc.
    participants: BatchParticipantWithProfile[];
    onClose: () => void;
    onSave: () => void;
}

const clusterOptions = ['N/A', 'Cluster A', 'Cluster B', 'Cluster C', 'Cluster D'];

export const ManageLevelClustersModal: React.FC<ManageLevelClustersModalProps> = ({ batchId, levelId, participants, onClose, onSave }) => {
    const [updates, setUpdates] = useState<ParticipantUpdate[]>([]);
    const [saving, setSaving] = useState(false);
    
    // The keys for the database columns based on levelId
    const clusterKey = levelId === 'overall' ? 'overall_cluster' : `level_${levelId}_cluster`;
    const commentsKey = levelId === 'overall' ? 'overall_comments' : `level_${levelId}_comments`;
    const levelName = levelId === 'overall' ? 'Overall' : `Level ${levelId}`;

    useEffect(() => {
        // Initialize the local state with current data from props
        const initialUpdates = participants.map(p => ({
            participant_id: p.participant_id,
            cluster: p[clusterKey as keyof typeof p] as string | null,
            comments: p[commentsKey as keyof typeof p] as string | null,
        }));
        setUpdates(initialUpdates);
    }, [participants, clusterKey, commentsKey]);

    const handleUpdate = (participantId: string, field: 'cluster' | 'comments', value: string | null) => {
        setUpdates(prevUpdates =>
            prevUpdates.map(u =>
                u.participant_id === participantId ? { ...u, [field]: value === '' ? null : value } : u
            )
        );
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        
        const upsertData = updates.map(update => ({
            batch_id: batchId,
            participant_id: update.participant_id,
            [clusterKey]: update.cluster === 'N/A' ? null : update.cluster,
            [commentsKey]: update.comments,
        }));
        
        const { error } = await supabase
            .from('batch_participants')
            .upsert(upsertData, { onConflict: 'batch_id, participant_id' });

        if (error) {
            alert(`Error saving changes: ${error.message}`);
        } else {
            onSave();
        }
        setSaving(false);
    };
    
    const getParticipantProfile = (participantId: string) => {
        return participants.find(p => p.participant_id === participantId)?.profiles;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold">Manage {levelName} Clusters & Comments</h2>
                </div>

                <div className="p-4 flex-grow overflow-y-auto">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                             <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium">Participant</th>
                                    <th className="px-4 py-2 text-left font-medium w-40">Cluster</th>
                                    <th className="px-4 py-2 text-left font-medium">Comments</th>
                                </tr>
                             </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {updates.map(update => (
                                    <tr key={update.participant_id}>
                                        <td className="px-4 py-2 whitespace-nowrap font-semibold">{getParticipantProfile(update.participant_id)?.name}</td>
                                        <td className="px-4 py-2">
                                            <select 
                                                value={update.cluster || 'N/A'} 
                                                onChange={e => handleUpdate(update.participant_id, 'cluster', e.target.value)} 
                                                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                                            >
                                                {clusterOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={update.comments || ''}
                                                onChange={e => handleUpdate(update.participant_id, 'comments', e.target.value)}
                                                className="w-full p-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600"
                                                placeholder="Add comments..."
                                            />
                                        </td>
                                    </tr>
                                ))}
                             </tbody>
                        </table>
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
