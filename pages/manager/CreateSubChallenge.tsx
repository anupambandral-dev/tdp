import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { EvaluationRules, ResultTier, IncorrectMarking, OverallChallenge, Json, Profile, Role } from '../../types';
import { TablesInsert } from '../../database.types';

export const CreateSubChallenge: React.FC = () => {
    const { challengeId } = useParams<{ challengeId: string }>();
    const navigate = useNavigate();
    const [overallChallenge, setOverallChallenge] = useState<OverallChallenge | null>(null);
    const [loading, setLoading] = useState(true);

    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [title, setTitle] = useState('');
    const [patentNumber, setPatentNumber] = useState('');
    const [summary, setSummary] = useState('');
    const [claimFocus, setClaimFocus] = useState('');
    const [submissionEndTime, setSubmissionEndTime] = useState('');
    const [rules, setRules] = useState<EvaluationRules>({
        tierScores: {
            [ResultTier.TIER_1]: 20,
            [ResultTier.TIER_2]: 10,
            [ResultTier.TIER_3]: 5,
        },
        incorrectMarking: IncorrectMarking.ZERO,
        incorrectPenalty: 0,
        report: { enabled: false, maxScore: 30 }
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!challengeId) return;
            setLoading(true);
            
            const challengePromise = supabase
                .from('overall_challenges')
                .select('*')
                .eq('id', challengeId)
                .single<OverallChallenge>();
            
            const profilesPromise = supabase
                .from('profiles')
                .select('*')
                .order('name');

            const [challengeResult, profilesResult] = await Promise.all([challengePromise, profilesPromise]);

            if (challengeResult.error) console.error(challengeResult.error);
            else if (challengeResult.data) setOverallChallenge(challengeResult.data);

            if (profilesResult.error) console.error(profilesResult.error);
            else if (profilesResult.data) setAllProfiles(profilesResult.data as unknown as Profile[]);
            
            setLoading(false);
        };
        fetchData();
    }, [challengeId]);

    const handleToggleEvaluator = (profileId: string) => {
        setSelectedEvaluatorIds(prev =>
            prev.includes(profileId) ? prev.filter(id => id !== profileId) : [...prev, profileId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!submissionEndTime || new Date(submissionEndTime) <= new Date()) {
            alert('Submission end time must be set and must be in the future.');
            return;
        }

        setLoading(true);

        const evaluatorsToUpdate = allProfiles
            .filter(p => selectedEvaluatorIds.includes(p.id) && p.role !== Role.EVALUATOR);

        if (evaluatorsToUpdate.length > 0) {
            const updates = evaluatorsToUpdate.map(p => 
                supabase.from('profiles').update({ role: Role.EVALUATOR }).eq('id', p.id)
            );
            const results = await Promise.all(updates);
            const updateError = results.find(res => res.error);
            if (updateError) {
                alert(`Error updating user roles: ${updateError.error?.message}`);
                setLoading(false);
                return;
            }
        }

        const newSubChallenge: TablesInsert<'sub_challenges'> = {
            overall_challenge_id: challengeId!,
            title,
            patent_number: patentNumber,
            summary,
            claim_focus: claimFocus,
            submission_end_time: new Date(submissionEndTime).toISOString(),
            evaluation_rules: rules as unknown as Json,
            evaluator_ids: selectedEvaluatorIds,
        };

        const { error } = await supabase.from('sub_challenges').insert([newSubChallenge]);

        if (error) {
            alert(`Error creating sub-challenge: ${error.message}`);
        } else {
            alert('New sub-challenge created!');
            navigate(`/manager/challenge/${challengeId}`);
        }
        setLoading(false);
    };

    const filteredProfiles = allProfiles.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading && !overallChallenge) return <div className="p-8">Loading...</div>
    if (!overallChallenge) {
        return <div className="text-center p-8">Overall Challenge not found.</div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/manager/challenge/${challengeId}`} text="Back to Challenge" />
            <Card>
                <h1 className="text-3xl font-bold mb-2">Create New Sub-Challenge</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">For "{overallChallenge.name}"</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="title">Title</label>
                            <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className="input" />
                        </div>
                        <div>
                            <label htmlFor="patentNumber">Patent Number</label>
                            <input id="patentNumber" type="text" value={patentNumber} onChange={e => setPatentNumber(e.target.value)} className="input" />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="summary">Summary</label>
                        <textarea id="summary" value={summary} onChange={e => setSummary(e.target.value)} rows={3} className="input" />
                    </div>
                    <div>
                        <label htmlFor="claimFocus">Claim Focus</label>
                        <textarea id="claimFocus" value={claimFocus} onChange={e => setClaimFocus(e.target.value)} rows={2} className="input" />
                    </div>
                    <div>
                        <label htmlFor="submissionEndTime">Submission End Time</label>
                        <input id="submissionEndTime" type="datetime-local" value={submissionEndTime} onChange={e => setSubmissionEndTime(e.target.value)} required className="input" />
                    </div>
                    
                    <div>
                        <label htmlFor="search-evaluators" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Assign Evaluators</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select users to evaluate submissions for this sub-challenge. If a user is not an 'Evaluator', their role will be updated automatically.</p>
                        <input
                            id="search-evaluators"
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="mt-1 block w-full input"
                        />
                        <div className="mt-2 border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 bg-gray-50 dark:bg-gray-800">
                            {loading ? <p className="text-center p-4">Loading users...</p> : filteredProfiles.map(profile => (
                                <label key={profile.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={selectedEvaluatorIds.includes(profile.id)}
                                        onChange={() => handleToggleEvaluator(profile.id)}
                                    />
                                    <img src={profile.avatar_url ?? ''} alt={profile.name} className="h-8 w-8 rounded-full" />
                                    <div>
                                        <p className="font-medium text-sm">{profile.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{profile.email} ({profile.role})</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{selectedEvaluatorIds.length} evaluator(s) selected.</p>
                    </div>

                    <div className="pt-4 border-t dark:border-gray-700">
                        <h2 className="text-xl font-semibold">Evaluation Rules</h2>
                         <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-medium mb-2">Tier Scores</h3>
                                <div className="space-y-2">
                                    {Object.values(ResultTier).map(tier => (
                                        <div key={tier} className="flex items-center gap-4">
                                            <label htmlFor={`tier_${tier}`} className="w-20">{tier}</label>
                                            <input id={`tier_${tier}`} type="number" value={rules.tierScores[tier]} onChange={e => setRules(prev => ({...prev, tierScores: {...prev.tierScores, [tier]: Number(e.target.value)}}))} className="input w-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium mb-2">Incorrect Result Marking</h3>
                                <select value={rules.incorrectMarking} onChange={e => setRules(prev => ({...prev, incorrectMarking: e.target.value as IncorrectMarking}))} className="input w-full">
                                    <option value={IncorrectMarking.ZERO}>Award Zero Points</option>
                                    <option value={IncorrectMarking.PENALTY}>Apply Penalty</option>
                                </select>
                                {rules.incorrectMarking === IncorrectMarking.PENALTY && (
                                    <div className="mt-2">
                                        <label htmlFor="penalty">Penalty (negative value)</label>
                                        <input id="penalty" type="number" value={rules.incorrectPenalty} onChange={e => setRules(prev => ({...prev, incorrectPenalty: Number(e.target.value)}))} className="input w-full" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-6">
                            <h3 className="font-medium mb-2">Report Evaluation</h3>
                            <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={rules.report.enabled} onChange={e => setRules(prev => ({...prev, report: {...prev.report, enabled: e.target.checked}}))} />
                                <span>Enable report submission and scoring</span>
                            </label>
                             {rules.report.enabled && (
                                <div className="mt-2">
                                    <label htmlFor="maxScore">Report Max Score</label>
                                    <input id="maxScore" type="number" value={rules.report.maxScore} onChange={e => setRules(prev => ({...prev, report: {...prev.report, maxScore: Number(e.target.value)}}))} className="input w-full" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Sub-Challenge'}</Button>
                    </div>
                </form>
            </Card>
            <style>{`label { display: block; margin-bottom: 0.25rem; font-weight: 500; } .input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};