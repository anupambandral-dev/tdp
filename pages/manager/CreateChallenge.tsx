import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Profile } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TablesInsert } from '../../database.types';

interface CreateChallengeProps {
    currentUser: Profile;
}

export const CreateChallenge: React.FC<CreateChallengeProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [challengeName, setChallengeName] = useState('');
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [selectedTraineeIds, setSelectedTraineeIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfiles = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('profiles').select('*').order('name', { ascending: true });
            if (data) {
                setAllProfiles(data);
            }
            if (error) {
                console.error("Error fetching profiles:", error);
                alert("Could not load user list.");
            }
            setLoading(false);
        };
        fetchProfiles();
    }, []);

    const handleToggleTrainee = (profileId: string) => {
        setSelectedTraineeIds(prev =>
            prev.includes(profileId) ? prev.filter(id => id !== profileId) : [...prev, profileId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!challengeName.trim()) {
            alert('Please provide a challenge name.');
            return;
        }
        if (selectedTraineeIds.length === 0) {
            alert('Please select at least one trainee.');
            return;
        }

        setLoading(true);

        const newChallenge: TablesInsert<'overall_challenges'> = {
            name: challengeName,
            manager_ids: [currentUser.id],
            trainee_ids: selectedTraineeIds,
        };

        const { error } = await supabase.from('overall_challenges').insert([newChallenge]);

        if (error) {
            alert(`Error creating challenge: ${error.message}`);
            setLoading(false);
        } else {
            alert('New challenge created successfully!');
            navigate('/manager');
        }
    };

    const filteredProfiles = allProfiles.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <Link to="/manager" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
            <Card>
                <h1 className="text-3xl font-bold mb-6">Create New Overall Challenge</h1>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <label htmlFor="challengeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Challenge Name</label>
                        <input
                            type="text" id="challengeName"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                            value={challengeName} onChange={(e) => setChallengeName(e.target.value)}
                            placeholder="e.g., Tour de Prior Art - August 2024" required
                        />
                    </div>

                    <div>
                        <label htmlFor="search-trainees" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select Trainees</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Search by name or email to add trainees to this challenge.</p>
                        <input
                            id="search-trainees"
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                        />
                        <div className="mt-2 border rounded-md max-h-60 overflow-y-auto p-2 space-y-1 bg-gray-50 dark:bg-gray-800">
                            {loading ? <p className="text-center p-4">Loading users...</p> : filteredProfiles.map(profile => (
                                <label key={profile.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedTraineeIds.includes(profile.id)}
                                        onChange={() => handleToggleTrainee(profile.id)}
                                    />
                                    <img src={profile.avatar_url ?? ''} alt={profile.name} className="h-8 w-8 rounded-full" />
                                    <div>
                                        <p className="font-medium text-sm">{profile.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{selectedTraineeIds.length} trainee(s) selected.</p>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                        <Link to="/manager">
                            <Button type="button" variant="secondary" disabled={loading}>Cancel</Button>
                        </Link>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Challenge'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
