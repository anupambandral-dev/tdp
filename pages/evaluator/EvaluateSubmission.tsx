import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { Profile, ResultEvaluation, SubmittedResult, SubChallenge, Submission, Evaluation, EvaluationRules, SubmissionWithProfile, SubChallengeWithSubmissions, Json, EvaluationResultTier, OverallChallenge, ResultType } from '../../types';

const normalizeResultValue = (value: string, type: SubmittedResult['type']): string => {
    let normalized = value.trim().toLowerCase();
    if (type === ResultType.NON_PATENT) {
        // Simple URL-like normalization
        normalized = normalized.replace(/^https?:\/\//, ''); // remove protocol
        normalized = normalized.replace(/^www\./, ''); // remove www.
        if (normalized.endsWith('/')) {
            normalized = normalized.slice(0, -1); // remove trailing slash
        }
        return normalized;
    }
    // For patents, also make it more robust by removing common separators
    return normalized.replace(/[-/,\s]/g, '');
};

const DuplicateCheckView: React.FC<{ submissions: SubmissionWithProfile[] }> = ({ submissions }) => {
    const duplicateResults = useMemo(() => {
        const resultsMap = new Map<string, { originalValue: string, submitters: { profile: Profile | null; submittedAt: string }[] }>();

        submissions.forEach(sub => {
            const results = (sub.results as unknown as SubmittedResult[]) || [];
            results.forEach(result => {
                const normalizedValue = normalizeResultValue(result.value, result.type);
                if (!resultsMap.has(normalizedValue)) {
                    resultsMap.set(normalizedValue, { originalValue: result.value, submitters: [] });
                }
                resultsMap.get(normalizedValue)!.submitters.push({
                    profile: sub.profiles,
                    submittedAt: result.submitted_at || sub.submitted_at // Fallback to overall submission time
                });
            });
        });

        const duplicates = Array.from(resultsMap.values())
            .filter(item => item.submitters.length > 1);
        
        return duplicates;
    }, [submissions]);

    if (duplicateResults.length === 0) {
        return (
            <Card>
                <p className="text-center text-gray-500">No duplicate results found among submissions.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Duplicate Results Found</h2>
            {duplicateResults.map(({ originalValue, submitters }) => (
                <Card key={originalValue}>
                    <h3 className="text-lg font-semibold font-mono break-all">{originalValue}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Submitted by {submitters.length} trainees:</p>
                    <ul className="space-y-3">
                        {submitters
                            .sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime()) // Sort by submission time
                            .map(({ profile, submittedAt }, index) => (
                            <li key={profile?.id || index} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <span className="font-medium text-sm">{profile?.name || 'Unknown Trainee'}</span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                    {submittedAt ? new Date(submittedAt).toLocaleString() : 'N/A'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </Card>
            ))}
        </div>
    );
};


interface EvaluateSubmissionProps {
    currentUser: Profile;
}

type SubChallengeForEvaluation = SubChallengeWithSubmissions & {
    overall_challenges: Pick<OverallChallenge, 'ended_at'> | null;
};

export const EvaluateSubmission: React.FC<EvaluateSubmissionProps> = ({ currentUser }) => {
    const { challengeId } = useParams<{ challengeId: string }>();
    const navigate = useNavigate();
    const [challenge, setChallenge] = useState<SubChallengeForEvaluation | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'evaluate' | 'duplicates'>('evaluate');
    
    // Derived state for the selected submission
    const selectedSubmission = useMemo(() => {
        return challenge?.submissions?.find(s => s.trainee_id === selectedTraineeId);
    }, [challenge, selectedTraineeId]);
    
    // Form state
    const [resultEvals, setResultEvals] = useState<ResultEvaluation[]>([]);
    const [reportScore, setReportScore] = useState<number | string>('');
    const [feedback, setFeedback] = useState<string>('');
    const [reportUrl, setReportUrl] = useState<string | null>(null);

    // State to track saved data for change detection
    const [savedEvaluation, setSavedEvaluation] = useState<Evaluation | null>(null);
    
    // Loading/submitting states
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const allResultsMap = useMemo(() => {
        const map = new Map<string, { profile: Profile | null; submittedAt: string; traineeId: string }[]>();
        if (!challenge) return map;
    
        challenge.submissions.forEach(sub => {
            const results = (sub.results as unknown as SubmittedResult[]) || [];
            results.forEach(result => {
                const normalizedValue = normalizeResultValue(result.value, result.type);
                if (!map.has(normalizedValue)) {
                    map.set(normalizedValue, []);
                }
                map.get(normalizedValue)!.push({
                    profile: sub.profiles,
                    submittedAt: result.submitted_at || sub.submitted_at,
                    traineeId: sub.trainee_id,
                });
            });
        });
    
        // Sort each entry by submission time
        map.forEach(submitters => {
            submitters.sort((a, b) => new Date(a.submittedAt || 0).getTime() - new Date(b.submittedAt || 0).getTime());
        });
    
        return map;
    }, [challenge]);

    const fetchChallenge = useCallback(async () => {
        if (!challengeId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('sub_challenges')
            .select('*, submissions(*, profiles(id, name, avatar_url, email, role)), overall_challenges(ended_at)')
            .eq('id', challengeId)
            .single<SubChallengeForEvaluation>();
        
        if (error) {
            console.error(error);
            setError(error.message);
        } else if (data) {
            setChallenge(data);
            if (data.submissions && data.submissions.length > 0 && !selectedTraineeId) {
                // Default to the first unevaluated submission, or just the first one.
                const firstUnevaluated = data.submissions.find(s => !s.evaluation);
                setSelectedTraineeId(firstUnevaluated?.trainee_id || data.submissions[0].trainee_id);
            }
        }
        setLoading(false);
    }, [challengeId, selectedTraineeId]);

    useEffect(() => {
        fetchChallenge();
    }, [fetchChallenge]);
    
    // Effect to reset form when selected trainee changes
    useEffect(() => {
        if (!selectedSubmission || !selectedTraineeId) {
            // Clear form if no submission is selected
            setResultEvals([]);
            setReportScore('');
            setFeedback('');
            setSavedEvaluation(null);
            setReportUrl(null);
            return;
        };

        const submittedResults = (selectedSubmission.results as unknown as SubmittedResult[]) || [];
        const existingEval = selectedSubmission.evaluation as unknown as Evaluation | null;

        // Create a full list of evaluations, ensuring one for each submitted result.
        const initialEvals = submittedResults.map(result => {
            const existing = existingEval?.result_evaluations.find(re => re.result_id === result.id);

            let scoreOverride: number | null = existing?.score_override ?? null;
            let overrideReason: string = existing?.override_reason || '';

            // Auto-set override for duplicates if this is a new evaluation
            if (!existing) {
                const duplicatesInfo = allResultsMap.get(normalizeResultValue(result.value, result.type));
                const isDuplicate = duplicatesInfo && duplicatesInfo.length > 1;
                const isFirst = isDuplicate && duplicatesInfo[0].traineeId === selectedTraineeId;
                if (isDuplicate && !isFirst) {
                    scoreOverride = 0;
                    overrideReason = `Duplicate. First submitted by ${duplicatesInfo[0].profile?.name}.`;
                }
            }

            return {
                result_id: result.id,
                evaluator_tier: existing?.evaluator_tier || EvaluationResultTier.TIER_3,
                score_override: scoreOverride,
                override_reason: overrideReason
            };
        });
        
        setResultEvals(initialEvals);
        setReportScore(existingEval?.report_score ?? '');
        setFeedback(existingEval?.feedback ?? '');

        // Set the baseline for change detection
        const baselineEval: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: initialEvals,
            report_score: existingEval?.report_score,
            feedback: existingEval?.feedback ?? '',
            evaluated_at: new Date().toISOString(),
        };
        setSavedEvaluation(baselineEval);
        
        // Fetch report URL
        const fetchUrl = async () => {
            if (selectedSubmission.report_file) {
                const reportPath = (selectedSubmission.report_file as { path: string }).path;
                const { data, error } = await supabase.storage.from('reports').createSignedUrl(reportPath, 300); // 5 mins
                if (error) console.error("Error creating signed URL:", error);
                else setReportUrl(data.signedUrl);
            } else {
                setReportUrl(null);
            }
        };
        fetchUrl();

    }, [selectedSubmission, currentUser.id, allResultsMap, selectedTraineeId]);

    const handleSave = async (isFinalSubmit: boolean = false) => {
        if (!selectedSubmission) return;
        
        setError(null);
        setSuccess(null);
        setIsSaving(true);

        const newEvaluation: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: resultEvals.map(re => ({
                ...re,
                score_override: re.score_override === null || re.score_override === undefined ? null : Number(re.score_override)
            })),
            report_score: reportScore === '' ? undefined : Number(reportScore),
            feedback: feedback,
            evaluated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from('submissions')
            .update({ evaluation: newEvaluation as unknown as Json })
            .eq('id', selectedSubmission.id);
        
        setIsSaving(false);

        if (updateError) {
            setError(`Failed to save: ${updateError.message}`);
        } else {
            setSavedEvaluation(newEvaluation); // Update baseline
            if (!isFinalSubmit) {
                setSuccess('Evaluation progress saved!');
                setTimeout(() => setSuccess(null), 3000);
            }
        }
    };
    
    const handleSubmitAllAndNext = async () => {
        await handleSave(true);
        // Find next trainee
        const currentIndex = challenge?.submissions.findIndex(s => s.trainee_id === selectedTraineeId) ?? -1;
        const nextIndex = (currentIndex + 1) % (challenge?.submissions.length ?? 1);
        if (challenge?.submissions[nextIndex] && currentIndex < (challenge.submissions.length -1)) {
            setSelectedTraineeId(challenge.submissions[nextIndex].trainee_id);
        } else {
            // Last trainee, just refetch
            setSelectedTraineeId(selectedTraineeId);
        }
        await fetchChallenge(); // Re-fetch to update progress bar on dashboard
    };

    if (loading) return <div className="p-8">Loading evaluation...</div>;
    if (!challenge) return <div className="p-8 text-center">Challenge not found.</div>;
    if (challenge.submissions.length === 0) {
        return (
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <BackButton to="/evaluator" text="Back to Dashboard" />
                <Card className="text-center py-10">
                    <p className="text-gray-500">There are no submissions for this challenge yet.</p>
                </Card>
            </div>
        );
    }
    
    // FIX: Cast to unknown first to safely convert from Json type to SubmittedResult[]
    const submittedResults = (selectedSubmission?.results as unknown as SubmittedResult[]) || [];
    const rules = challenge.evaluation_rules as unknown as EvaluationRules;
    const isChallengeEnded = !!challenge.overall_challenges?.ended_at;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/evaluator" text="Back to Dashboard" />
            <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Evaluation Form</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <h2 className="text-xl font-semibold mb-4">Trainees</h2>
                    <Card>
                        <ul className="space-y-1">
                            {challenge.submissions.map(sub => (
                                <li key={sub.trainee_id}>
                                    <button
                                        onClick={() => setSelectedTraineeId(sub.trainee_id)}
                                        className={`w-full text-left p-3 rounded-lg flex items-center justify-between ${selectedTraineeId === sub.trainee_id ? 'bg-blue-100 dark:bg-blue-900/40' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        <span className="font-medium">{sub.profiles?.name}</span>
                                        {sub.evaluation && <span className="text-green-500 text-xs font-bold">✓ Evaluated</span>}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>

                <div className="lg:col-span-3">
                    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button onClick={() => setActiveTab('evaluate')} className={`${activeTab === 'evaluate' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Evaluate Submission
                            </button>
                            <button onClick={() => setActiveTab('duplicates')} className={`${activeTab === 'duplicates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Duplicate Check
                            </button>
                        </nav>
                    </div>

                    {activeTab === 'evaluate' && (
                        <>
                            {selectedSubmission ? (
                                <Card>
                                    <div className="pb-4 mb-6 border-b dark:border-gray-700">
                                        <h2 className="text-2xl font-semibold">Evaluating: {selectedSubmission.profiles?.name}</h2>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Submitted at: {new Date(selectedSubmission.submitted_at).toLocaleString()}</p>
                                    </div>

                                    {isChallengeEnded && (
                                        <div className="mb-4 p-3 rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm" role="status">
                                            This challenge has ended. Evaluations are now read-only and cannot be modified.
                                        </div>
                                    )}
                                    
                                    {error && <div className="mb-4 p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-sm" role="alert">{error}</div>}
                                    {success && <div className="mb-4 p-3 rounded-md bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm" role="alert">{success}</div>}

                                    <div className="space-y-6">
                                        <div>
                                            <h3 className="text-lg font-semibold mb-2">Submitted Results</h3>
                                            {submittedResults.map((result) => {
                                                const currentEval = resultEvals.find(re => re.result_id === result.id);
                                                const duplicatesInfo = allResultsMap.get(normalizeResultValue(result.value, result.type));
                                                const isDuplicate = duplicatesInfo && duplicatesInfo.length > 1;
                                                const isFirstSubmitter = isDuplicate && duplicatesInfo[0].traineeId === selectedTraineeId;

                                                return (
                                                <div key={result.id} className="p-3 mb-2 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                                                    <div>
                                                        <p className="font-mono text-sm">{result.value}</p>
                                                        {isDuplicate && (
                                                            <p className={`text-xs font-semibold ${isFirstSubmitter ? 'text-green-600 dark:text-green-400' : 'text-orange-500 dark:text-orange-400'}`}>
                                                                {isFirstSubmitter 
                                                                    ? 'You were the first to submit this result.' 
                                                                    : `Duplicate. First submitted by ${duplicatesInfo[0].profile?.name}.`}
                                                            </p>
                                                        )}
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                            {result.type} - Submitted as {result.trainee_tier}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <select
                                                            value={currentEval?.evaluator_tier || ''}
                                                            onChange={(e) => {
                                                                const newTier = e.target.value as EvaluationResultTier;
                                                                setResultEvals(prev => prev.map(re => re.result_id === result.id ? { ...re, evaluator_tier: newTier } : re));
                                                            }}
                                                            className="input w-32"
                                                            disabled={isChallengeEnded}
                                                        >
                                                            {Object.values(EvaluationResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                                        </select>
                                                        <input 
                                                            type="number" 
                                                            placeholder="Score" 
                                                            title="Override Score"
                                                            className="input w-24"
                                                            value={currentEval?.score_override ?? ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setResultEvals(prev => prev.map(re => re.result_id === result.id ? { ...re, score_override: value === '' ? null : Number(value) } : re));
                                                            }}
                                                            disabled={isChallengeEnded}
                                                        />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Reason for override"
                                                            title="Reason for override"
                                                            className="input flex-grow min-w-40"
                                                            value={currentEval?.override_reason ?? ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                setResultEvals(prev => prev.map(re => re.result_id === result.id ? { ...re, override_reason: value } : re));
                                                            }}
                                                            disabled={isChallengeEnded}
                                                        />
                                                    </div>
                                                </div>
                                            )})}
                                        </div>
                                        {rules.report.enabled && (
                                            <div className="pt-6 border-t dark:border-gray-700">
                                                <h3 className="text-lg font-semibold mb-2">Report & Feedback</h3>
                                                <div className="space-y-4">
                                                    <div>
                                                        <label htmlFor="reportScore">Report Score (Max: {rules.report.maxScore})</label>
                                                        <input id="reportScore" type="number" max={rules.report.maxScore} min="0" value={reportScore} onChange={e => setReportScore(e.target.value)} className="input" disabled={isChallengeEnded} />
                                                        {reportUrl && (
                                                            <a href={reportUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-1 block">
                                                                View Submitted Report
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label htmlFor="feedback">Overall Feedback</label>
                                                        <textarea id="feedback" value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} className="input" disabled={isChallengeEnded} />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 mt-6 border-t dark:border-gray-700 flex justify-end items-center gap-4">
                                        <Button onClick={() => handleSave(false)} variant="secondary" disabled={isSaving || isChallengeEnded}>
                                            {isSaving ? 'Saving...' : 'Save Progress'}
                                        </Button>
                                        <Button onClick={handleSubmitAllAndNext} disabled={isSaving || isChallengeEnded}>
                                            {isSaving ? 'Submitting...' : 'Submit & Next'}
                                        </Button>
                                    </div>
                                </Card>
                            ) : (
                                <Card className="flex items-center justify-center h-96">
                                    <p className="text-gray-500">Select a trainee from the list to begin evaluation.</p>
                                </Card>
                            )}
                        </>
                    )}
                    
                    {activeTab === 'duplicates' && challenge && (
                        <DuplicateCheckView submissions={challenge.submissions} />
                    )}
                </div>
            </div>
            <style>{`.input { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; padding: 0.5rem 0.75rem; } .dark .input { background-color: #374151; border-color: #4B5563; }`}</style>
        </div>
    );
};
