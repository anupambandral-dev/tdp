


import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { EvaluationRules, ResultTier, IncorrectMarking, OverallChallenge, Json, Profile, Role, ResultType } from '../../types';
import { TablesInsert, TablesUpdate } from '../../database.types';
import { RichTextInput } from '../../components/ui/RichTextInput';

export const CreateSubChallenge: React.FC = () => {
    const { batchId, challengeId } = useParams<{ batchId: string, challengeId: string }>();
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
    const [reportEndTime, setReportEndTime] = useState('');
    const [submissionLimit, setSubmissionLimit] = useState<number | string>(6);
    const [rules, setRules] = useState<EvaluationRules>({
        tierScores: {
            [ResultType.PATENT]: {
                [ResultTier.TIER_1]: 20,
                [ResultTier.TIER_2]: 10,
                [ResultTier.TIER_3]: 5,
            },
            [ResultType.NON_PATENT]: {
                [ResultTier.TIER_1]: 15,
                [ResultTier.TIER_2]: 8,
                [ResultTier.TIER_3]: 3,
            },
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
                .eq('id', challengeId!)
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

    const handleScoreChange = (resultType: ResultType, tier: ResultTier, value: number) => {
        setRules(prev => ({
            ...prev,
            tierScores: {
                ...prev.tierScores,
                [resultType]: {
                    ...prev.tierScores[resultType],
                    [tier]: value
                }
            }
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!submissionEndTime || new Date(submissionEndTime) <= new Date()) {
            alert('Results submission end time must be set and must be in the future.');
            return;
        }

        if (rules.report.enabled && (!reportEndTime || new Date(reportEndTime) <= new Date())) {
            alert('If reports are enabled, the report end time must be set and must be in the future.');
            return;
        }

        if (rules.report.enabled && new Date(reportEndTime) < new Date(submissionEndTime)) {
            alert('Report end time cannot be before the results submission end time.');
            return;
        }

        setLoading(true);

        const evaluatorsToUpdate = allProfiles
            .filter(p => selectedEvaluatorIds.includes(p.id) && p.role !== Role.EVALUATOR);

        if (evaluatorsToUpdate.length > 0) {
            const updates = evaluatorsToUpdate.map(p => 
                supabase.from('profiles').update({ role: Role.EVALUATOR as 'Evaluator' }).eq('id', p.id)
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
            report_end_time: rules.report.enabled ? new Date(reportEndTime).toISOString() : null,
            submission_limit: submissionLimit === '' ? null : Number(submissionLimit),
            evaluation_rules: rules as unknown as Json,
            evaluator_ids: selectedEvaluatorIds,
        };

        const { error } = await supabase.from('sub_challenges').insert([newSubChallenge]);

        if (error) {
            alert(`Error creating sub-challenge: ${error.message}`);
        } else {
            alert('New sub-challenge created!');
            navigate(`/batch/${batchId}/level/4/challenge/${challengeId}`);
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

    const inputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2";
    const labelClasses = "block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300";


    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
            <BackButton to={`/batch/${batchId}/level/4/challenge/${challengeId}`} text="Back to Challenge" />
            <Card>
                <h1 className="text-3xl font-bold mb-2">Create New Sub-Challenge</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">For "{overallChallenge.name}"</p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="title" className={labelClasses}>Title</label>
                            <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required className={inputClasses} />
                        </div>
                        <div>
                            <label htmlFor="patentNumber" className={labelClasses}>Patent Number</label>
                            <input id="patentNumber" type="text" value={patentNumber} onChange={e => setPatentNumber(e.target.value)} className={inputClasses} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="submissionEndTime" className={labelClasses}>Results Submission End Time</label>
                        <input id="submissionEndTime" type="datetime-local" value={submissionEndTime} onChange={e => setSubmissionEndTime(e.target.value)} required className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="submissionLimit" className={labelClasses}>Max number of results per participant</label>
                        <input id="submissionLimit" type="number" value={submissionLimit} onChange={e => setSubmissionLimit(e.target.value)} placeholder="e.g., 6" min="1" className={inputClasses} />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Leave blank for no limit.</p>
                    </div>
                    <div>
                        <label htmlFor="summary" className={labelClasses}>Summary</label>
                        <RichTextInput value={summary} onChange={setSummary} />
                    </div>
                    <div>
                        <label htmlFor="claimFocus" className={labelClasses}>Claim Focus</label>
                        <textarea id="claimFocus" value={claimFocus} onChange={e => setClaimFocus(e.target.value)} rows={2} className={inputClasses} />
                    </div>
                    
                    <div>
                        <label htmlFor="search-evaluators" className={labelClasses}>Assign Evaluators</label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select users to evaluate submissions for this sub-challenge. If a user is not an 'Evaluator', their role will be updated automatically.</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">If no evaluators are assigned, the challenge managers will be responsible for evaluation.</p>
                        <input
                            id="search-evaluators"
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={`mt-1 block w-full ${inputClasses}`}
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
                         <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                <h3 className="font-medium col-span-2">Tier Scores</h3>
                                
                                <div className="font-semibold text-sm">Patent</div>
                                <div className="font-semibold text-sm">NPL</div>

                                {Object.values(ResultTier).map(tier => (
                                    <React.Fragment key={tier}>
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={`patent_tier_${tier}`} className={`${labelClasses} w-16 !mb-0`}>{tier}</label>
                                            <input id={`patent_tier_${tier}`} type="number" value={rules.tierScores[ResultType.PATENT][tier]} onChange={e => handleScoreChange(ResultType.PATENT, tier, Number(e.target.value))} className={`${inputClasses} w-full`} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label htmlFor={`npl_tier_${tier}`} className="sr-only">{tier} NPL</label>
                                            <input id={`npl_tier_${tier}`} type="number" value={rules.tierScores[ResultType.NON_PATENT][tier]} onChange={e => handleScoreChange(ResultType.NON_PATENT, tier, Number(e.target.value))} className={`${inputClasses} w-full`} />
                                        </div>
                                    </React.Fragment>
                                ))}
                            </div>
                            <div>
                                <h3 className="font-medium mb-2">Incorrect Result Marking</h3>
                                <select value={rules.incorrectMarking} onChange={e => setRules(prev => ({...prev, incorrectMarking: e.target.value as IncorrectMarking}))} className={`${inputClasses} w-full`}>
                                    <option value={IncorrectMarking.ZERO}>Award Zero Points</option>
                                    <option value={IncorrectMarking.PENALTY}>Apply Penalty</option>
                                </select>
                                {rules.incorrectMarking === IncorrectMarking.PENALTY && (
                                    <div className="mt-2">
                                        <label htmlFor="penalty" className={labelClasses}>Penalty (negative value)</label>
                                        <input id="penalty" type="number" value={rules.incorrectPenalty} onChange={e => setRules(prev => ({...prev, incorrectPenalty: Number(e.target.value)}))} className={`${inputClasses} w-full`} />
                                    </div>
                                )}
                                <div className="mt-6">
                                    <h3 className="font-medium mb-2">Report Evaluation</h3>
                                    <label className="flex items-center space-x-2">
                                        <input type="checkbox" checked={rules.report.enabled} onChange={e => setRules(prev => ({...prev, report: {...prev.report, enabled: e.target.checked}}))} />
                                        <span>Enable report submission and scoring</span>
                                    </label>
                                     {rules.report.enabled && (
                                        <>
                                            <div className="mt-2">
                                                <label htmlFor="maxScore" className={labelClasses}>Report Max Score</label>
                                                <input id="maxScore" type="number" value={rules.report.maxScore} onChange={e => setRules(prev => ({...prev, report: {...prev.report, maxScore: Number(e.target.value)}}))} className={`${inputClasses} w-full`} />
                                            </div>
                                            <div className="mt-4">
                                                <label htmlFor="reportEndTime" className={labelClasses}>Report Submission End Time</label>
                                                <input id="reportEndTime" type="datetime-local" value={reportEndTime} onChange={e => setReportEndTime(e.target.value)} required={rules.report.enabled} className={`${inputClasses} w-full`} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                        <Button type="submit" disabled={loading}>{loading ? 'Creating...' : 'Create Sub-Challenge'}</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};
