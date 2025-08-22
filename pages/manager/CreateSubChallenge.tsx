
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { EvaluationRules, ResultTier, IncorrectMarking, OverallChallenge } from '../../types';
import { TablesInsert } from '../../database.types';

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
                .single<OverallChallenge>();
            if (error) {
                console.error(error);
            } else if (data) {
                setOverallChallenge(data);
            }
            setLoading(false);
        };
        fetchOverallChallenge();
    }, [challengeId]);
    
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

        const newSubChallenge: TablesInsert<'sub_challenges'> = {
            overall_challenge_id: challengeId!,
            title,
            patent_number: patentNumber,
            summary,
            claim_focus: claimFocus,
            submission_end_time: new Date(submissionEndTime).toISOString(),
            evaluation_rules: rules as any,
        };

        const { error } = await supabase.from('sub_challenges').insert([newSubChallenge] as any);

        if (error) {
            alert(`Error creating sub-challenge: ${error.message}`);
            setLoading(false);
        } else {
            alert('New sub-challenge created!');
            navigate(`/manager/challenge/${challengeId}`);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>
    if (!overallChallenge) {
        return <div className="text-center p-8">Overall Challenge not found.</div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <Link to={`/manager/challenge/${challengeId}`} className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Challenge</Link>
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
                    
                    <div className="pt-4 border-t dark:border-gray-700">
                        <h2 className="text-xl font-semibold">Evaluation Rules</h2>
                         <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-medium mb-2">Tier Scores</h3>
                                <div className="space-y-2">
                                    {Object.values(ResultTier).map(tier => (
                                        <div key={tier} className="flex items-center gap-4">
                                            <label htmlFor={`tier_${tier}`} className="w-20">{tier}</label>
                                            <input id={`tier_${tier}`} type="number" value={rules.tierScores[tier]} onChange={e => handleTierScoreChange(tier, e.target.value)} className="input w-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h3 className="font-medium mb-2">Incorrect Result Marking</h3>
                                <select value={rules.incorrectMarking} onChange={e => handleRuleChange('incorrectMarking', e.target.value)} className="input w-full">
                                    <option value={IncorrectMarking.ZERO}>Award Zero Points</option>
                                    <option value={IncorrectMarking.PENALTY}>Apply Penalty</option>
                                </select>
                                {rules.incorrectMarking === IncorrectMarking.PENALTY && (
                                    <div className="mt-2">
                                        <label htmlFor="penalty">Penalty (negative value)</label>
                                        <input id="penalty" type="number" value={rules.incorrectPenalty} onChange={e => handleRuleChange('incorrectPenalty', Number(e.target.value))} className="input w-full" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-6">
                            <h3 className="font-medium mb-2">Report Evaluation</h3>
                            <label className="flex items-center space-x-2">
                                <input type="checkbox" checked={rules.report.enabled} onChange={e => handleRuleChange('report', {...rules.report, enabled: e.target.checked})} />
                                <span>Enable report submission and scoring</span>
                            </label>
                             {rules.report.enabled && (
                                <div className="mt-2">
                                    <label htmlFor="maxScore">Report Max Score</label>
                                    <input id="maxScore" type="number" value={rules.report.maxScore} onChange={e => handleRuleChange('report', {...rules.report, maxScore: Number(e.target.value)})} className="input w-full" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Sub-Challenge'}</Button>
                    </div>
                </form>
            </Card>
            <style>{`.input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};
