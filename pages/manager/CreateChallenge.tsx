

import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Profile, Role, OverallChallenge } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { TablesInsert } from '../../database.types';

interface CreateChallengeProps {
    currentUser: Profile;
}

const SearchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
);


export const CreateChallenge: React.FC<CreateChallengeProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const [allEmployees, setAllEmployees] = useState<Profile[]>([]);
    const [challengeName, setChallengeName] = useState('');
    const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set());
    const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);

    const [traineeSearch, setTraineeSearch] = useState('');
    const [evaluatorSearch, setEvaluatorSearch] = useState('');

    useEffect(() => {
        const fetchEmployees = async () => {
            const { data, error } = await supabase.from('profiles').select('*').returns<Profile[]>();
            if (error) {
                console.error('Error fetching employees:', error);
            } else if (data) {
                setAllEmployees(data);
            }
        };
        fetchEmployees();
    }, []);
    
    const trainees = useMemo(() => 
        allEmployees.filter(e => e.role === Role.TRAINEE && e.name.toLowerCase().includes(traineeSearch.toLowerCase())),
        [traineeSearch, allEmployees]
    );

    const evaluators = useMemo(() =>
        allEmployees.filter(e => e.role === Role.EVALUATOR && e.name.toLowerCase().includes(evaluatorSearch.toLowerCase())),
        [evaluatorSearch, allEmployees]
    );

    const handleToggleSelection = (id: string, selectionSet: Set<string>, setSelection: React.Dispatch<React.SetStateAction<Set<string>>>) => {
        const newSet = new Set(selectionSet);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelection(newSet);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!challengeName || selectedTraineeIds.size === 0 || selectedEvaluatorIds.size === 0) {
            alert('Please fill in all fields and select at least one trainee and one evaluator.');
            return;
        }
        setLoading(true);

        const newChallenge: TablesInsert<'overall_challenges'> = {
            name: challengeName,
            manager_ids: [currentUser.id],
            trainee_ids: Array.from(selectedTraineeIds),
            evaluator_ids: Array.from(selectedEvaluatorIds),
        };
        
        const { error } = await supabase.from('overall_challenges').insert([newChallenge] as any);

        if (error) {
            alert(`Error creating challenge: ${error.message}`);
        } else {
            alert('New challenge created successfully!');
            navigate('/manager');
        }
        setLoading(false);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <Link to="/manager" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
            <Card>
                <h1 className="text-3xl font-bold mb-6">Create New Overall Challenge</h1>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div>
                        <label htmlFor="challengeName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Challenge Name
                        </label>
                        <input
                            type="text"
                            id="challengeName"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                            value={challengeName}
                            onChange={(e) => setChallengeName(e.target.value)}
                            placeholder="e.g., Tour de Prior Art - August 2024"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Trainee Selection */}
                        <div>
                            <h2 className="font-semibold mb-2">Select Trainees ({selectedTraineeIds.size})</h2>
                            <div className="relative">
                                <SearchIcon />
                                <input 
                                    type="search"
                                    placeholder="Search trainees..."
                                    className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={traineeSearch}
                                    onChange={e => setTraineeSearch(e.target.value)}
                                />
                            </div>
                            <div className="mt-2 border rounded-md max-h-60 overflow-y-auto p-2 space-y-1">
                                {trainees.map(trainee => (
                                    <label key={trainee.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedTraineeIds.has(trainee.id)}
                                            onChange={() => handleToggleSelection(trainee.id, selectedTraineeIds, setSelectedTraineeIds)}
                                        />
                                        <img src={trainee.avatar_url} alt={trainee.name} className="h-8 w-8 rounded-full" />
                                        <span>{trainee.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Evaluator Selection */}
                        <div>
                            <h2 className="font-semibold mb-2">Select Evaluators ({selectedEvaluatorIds.size})</h2>
                            <div className="relative">
                                <SearchIcon />
                                <input 
                                    type="search"
                                    placeholder="Search evaluators..."
                                    className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                                    value={evaluatorSearch}
                                    onChange={e => setEvaluatorSearch(e.target.value)}
                                />
                            </div>
                            <div className="mt-2 border rounded-md max-h-60 overflow-y-auto p-2 space-y-1">
                                {evaluators.map(evaluator => (
                                    <label key={evaluator.id} className="flex items-center space-x-3 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedEvaluatorIds.has(evaluator.id)}
                                            onChange={() => handleToggleSelection(evaluator.id, selectedEvaluatorIds, setSelectedEvaluatorIds)}
                                        />
                                        <img src={evaluator.avatar_url} alt={evaluator.name} className="h-8 w-8 rounded-full" />
                                        <span>{evaluator.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4">
                        <Link to="/manager">
                           <Button type="button" variant="secondary" disabled={loading}>Cancel</Button>
                        </Link>
                        <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Challenge'}</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
