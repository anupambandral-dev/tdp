import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EvaluationRules, ResultTier, IncorrectMarking, OverallChallenge, SubChallenge } from '../../types';

export const CreateSubChallenge: React.FC = () => {
    const { challengeId } = useParams<{ challengeId: string }>();
    const navigate = useNavigate();
    const [overallChallenge, setOverallChallenge] = useState<OverallChallenge | null>(null);
    const [loading, setLoading] = useState(true);

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
        const fetchOverallChallenge = async () => {
            if (!challengeId) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('overall_challenges')
                .select('*')
                .eq('id', challengeId)
                .single();
            if (data) setOverallChallenge(data);
            setLoading(false);
        };
        fetchOverallChallenge();
    }, [challengeId]);
    
    if (loading) return <div className="p-8">Loading...</div>
    if (!overallChallenge) {
        return <div className="text-center p-8">Overall Challenge not found.</div>;
    }

    const handleRuleChange = (field: keyof EvaluationRules, value: any) => {
        setRules(prev => ({ ...prev, [field]: value }));
    };

    const handleTierScoreChange = (tier: ResultTier, value: string) => {
        const score = Number(value);
        if (!isNaN(score)) {
            handleRuleChange('tierScores', { ...rules.tierScores, [tier]: score });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!submissionEndTime || new Date(submissionEndTime) <= new Date()) {
            alert('Submission end time must be set and must be in the future.');
            return;
        }

        setLoading(true);

        const newSubChallenge: Omit<SubChallenge, 'id' | 'created_at' | 'submissions'> = {
            overall_challenge_id: challengeId!,
            title,
            patent_number: patentNumber,
            summary,
            claim_focus: claimFocus,
            submission_end_time: new Date(submissionEndTime).toISOString(),
            evaluation_rules: rules,
        };

        const { error } = await supabase.from('sub_challenges').insert(newSubChallenge);

        if (error) {
            alert(`Error creating sub-challenge: ${error.message}`);
        } else {
            alert('Sub-challenge created successfully!');
            navigate(`/manager/challenge/${challengeId}`);
        }
        setLoading(false);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <Link to={`/manager/challenge/${challengeId}`} className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Challenge Details</Link>
            <Card>
                <h1 className="text-2xl font-bold mb-1">Create Sub-Challenge</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">For "{overallChallenge.name}"</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium">Title</label>
                            <input type="text" id="title" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full input" required />
                        </div>
                        <div>
                            <label htmlFor="patentNumber" className="block text-sm font-medium">Patent Number</label>
                            <input type="text" id="patentNumber" value={patentNumber} onChange={e => setPatentNumber(e.target.value)} className="mt-1 block w-full input" required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="submissionEndTime" className="block text-sm font-medium">Submission End Time</label>
                        <input type="datetime-local" id="submissionEndTime" value={submissionEndTime} onChange={e => setSubmissionEndTime(e.target.value)} className="mt-1 block w-full input" required />
                    </div>
                    <div>
                        <label htmlFor="summary" className="block text-sm font-medium">Summary</label>
                        <textarea id="summary" value={summary} onChange={e => setSummary(e.target.value)} rows={3} className="mt-1 block w-full input" required />
                    </div>
                    <div>
                        <label htmlFor="claimFocus" className="block text-sm font-medium">Claim Focus</label>
                        <textarea id="claimFocus" value={claimFocus} onChange={e => setClaimFocus(e.target.value)} rows={2} className="mt-1 block w-full input" />
                    </div>

                    <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                        <h3 className="font-semibold text-lg">Evaluation Rules</h3>
                        <div>
                            <label className="block text-sm font-medium mb-1">Points for Correct Tier</label>
                            <div className="flex items-center space-x-4">
                                {Object.values(ResultTier).map(tier => (
                                    <div key={tier} className="flex items-center space-x-2">
                                        <label htmlFor={`tier-${tier}`}>{tier}:</label>
                                        <input type="number" id={`tier-${tier}`} value={rules.tierScores[tier]} onChange={e => handleTierScoreChange(tier, e.target.value)} className="input w-20" />
                                    </div>
                                ))}
                            </div>
                        </div>
                         <div>
                            <label className="block text-sm font-medium mb-1">Incorrect Categorization</label>
                            <div className="flex items-center space-x-4">
                               <label><input type="radio" name="incorrect" value={IncorrectMarking.ZERO} checked={rules.incorrectMarking === IncorrectMarking.ZERO} onChange={() => handleRuleChange('incorrectMarking', IncorrectMarking.ZERO)} /> Zero Points</label>
                               <label className="flex items-center space-x-2"><input type="radio" name="incorrect" value={IncorrectMarking.PENALTY} checked={rules.incorrectMarking === IncorrectMarking.PENALTY} onChange={() => handleRuleChange('incorrectMarking', IncorrectMarking.PENALTY)} /> Penalty: <input type="number" value={rules.incorrectPenalty} onChange={e => handleRuleChange('incorrectPenalty', Number(e.target.value))} className="input w-20" disabled={rules.incorrectMarking !== IncorrectMarking.PENALTY} /></label>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Report Score</label>
                             <div className="flex items-center space-x-4">
                                <label><input type="checkbox" checked={rules.report.enabled} onChange={e => handleRuleChange('report', {...rules.report, enabled: e.target.checked})} /> Enable Report Submission</label>
                                {rules.report.enabled && <label className="flex items-center space-x-2">Max Score: <input type="number" value={rules.report.maxScore} onChange={e => handleRuleChange('report', {...rules.report, maxScore: Number(e.target.value)})} className="input w-20" /></label>}
                             </div>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-4 pt-4 border-t dark:border-gray-700">
                        <Link to={`/manager/challenge/${challengeId}`}>
                           <Button type="button" variant="secondary" disabled={loading}>Cancel</Button>
                        </Link>
                        <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Sub-Challenge'}</Button>
                    </div>
                </form>
            </Card>
            <style>{`
                .input {
                    display: block;
                    width: 100%;
                    border-radius: 0.375rem;
                    border: 1px solid #D1D5DB;
                    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
                    padding: 0.5rem 0.75rem;
                }
                .dark .input {
                    background-color: #374151;
                    border-color: #4B5563;
                }
                .input:focus {
                    outline: 2px solid transparent;
                    outline-offset: 2px;
                    --tw-ring-color: #3B82F6;
                    border-color: var(--tw-ring-color);
                }
            `}</style>
        </div>
    );
};
