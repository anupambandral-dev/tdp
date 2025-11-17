import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { Profile, ResultEvaluation, SubmittedResult, SubChallenge, Submission, Evaluation, EvaluationRules, SubmissionWithProfile, SubChallengeWithSubmissions, Json, EvaluationResultTier, OverallChallenge, ResultType, Role, ResultTier, ReportEvaluationParameter } from '../../types';

const normalizeResultValue = (value: string, type: SubmittedResult['type']): string => {
    let normalized = value.trim().toLowerCase();
    if (type === ResultType.NON_PATENT) {
        // For NPL, we need to handle both document identifiers (e.g., 'R1-092785') and URLs.
        // This function uses a heuristic to decide which normalization strategy to apply.

        // Heuristic: If the string starts with 'http' or 'www.', treat it as a URL.
        const isUrl = normalized.startsWith('http') || normalized.startsWith('www.');

        if (isUrl) {
            // Normalize as a URL: remove protocol, 'www.' prefix, and trailing slash.
            normalized = normalized.replace(/^https?:\/\//, '');
            normalized = normalized.replace(/^www\./, '');
            if (normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        } else {
            // Treat as an identifier.
            // First, strip parenthetical content, which often contains URLs or comments.
            // E.g., 'R1-092785 (http://...)' becomes 'R1-092785'.
            normalized = normalized.replace(/\(.*\)/g, '').trim();
            // Then, apply the same normalization as patents to handle variations
            // in spacing and separators. E.g., 'R1 - 092785' becomes 'r1092785'.
            return normalized.replace(/[-/,\s]/g, '');
        }
    }
    // For patents, apply robust normalization by removing common separators.
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

const TierSubmissionsView: React.FC<{ tier: ResultTier; submissions: SubmissionWithProfile[] }> = ({ tier, submissions }) => {
    const tierResults = useMemo(() => {
        const results: { value: string; profile: Profile | null; submittedAt: string }[] = [];
        
        submissions.forEach(sub => {
            const submittedResults = (sub.results as unknown as SubmittedResult[]) || [];
            submittedResults.forEach(result => {
                if (result.trainee_tier === tier) {
                    results.push({
                        value: result.value,
                        profile: sub.profiles,
                        submittedAt: result.submitted_at || sub.submitted_at
                    });
                }
            });
        });

        // Sort by submission time, earliest first
        return results.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    }, [tier, submissions]);

    if (tierResults.length === 0) {
        return (
            <Card>
                <p className="text-center text-gray-500">No {tier} results submitted.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold">{tier} Submissions ({tierResults.length})</h2>
            <Card>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted By</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted At</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {tierResults.map((result, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-pre-wrap font-mono text-sm">{result.value}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{result.profile?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {new Date(result.submittedAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};


interface EvaluateSubmissionProps {
    currentUser: Profile;
}

type SubChallengeForEvaluation = SubChallengeWithSubmissions & {
    scores_published_at: string | null;
    overall_challenges: Pick<OverallChallenge, 'ended_at'> | null;
};

type ActiveTab = 'evaluate' | 'duplicates' | 'tier1' | 'tier2' | 'tier3';

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2h-4"></path></svg>
);

export const EvaluateSubmission: React.FC<EvaluateSubmissionProps> = ({ currentUser }) => {
    const { batchId, challengeId } = useParams<{ batchId: string; challengeId: string }>();
    const navigate = useNavigate();
    const [challenge, setChallenge] = useState<SubChallengeForEvaluation | null>(null);
    const [loading, setLoading] = useState(true);

    const [selectedTraineeId, setSelectedTraineeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<ActiveTab>('evaluate');
    
    // Derived state for the selected submission
    const selectedSubmission = useMemo(() => {
        return challenge?.submissions?.find(s => s.trainee_id === selectedTraineeId);
    }, [challenge, selectedTraineeId]);
    
    // Form state
    const [resultEvals, setResultEvals] = useState<ResultEvaluation[]>([]);
    const [reportParams, setReportParams] = useState<ReportEvaluationParameter[]>([]);
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
            .eq('id', challengeId!)
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
            setReportParams([]);
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

        const initialReportParams: ReportEvaluationParameter[] = [];
        if (existingEval?.report_evaluation) {
            initialReportParams.push(...existingEval.report_evaluation);
        } else if (existingEval?.report_score != null) {
            initialReportParams.push({ id: uuidv4(), parameter: 'Overall Score', score: existingEval.report_score });
        }
        setReportParams(initialReportParams);
        
        setFeedback(existingEval?.feedback ?? '');

        // Set the baseline for change detection
        const baselineEval: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: initialEvals,
            report_evaluation: initialReportParams,
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
        if (!selectedSubmission || !challenge) return;
        
        setError(null);
        setSuccess(null);
        setIsSaving(true);
        const rules = challenge.evaluation_rules as unknown as EvaluationRules;

        const totalReportScore = reportParams.reduce((sum, p) => sum + (Number(p.score) || 0), 0);
        if (rules.report.enabled && totalReportScore > rules.report.maxScore) {
            setError(`Total report score (${totalReportScore}) cannot exceed the maximum of ${rules.report.maxScore}.`);
            setIsSaving(false);
            return;
        }

        const newEvaluation: Evaluation = {
            evaluator_id: currentUser.id,
            result_evaluations: resultEvals.map(re => ({
                ...re,
                score_override: re.score_override === null || re.score_override === undefined ? null : Number(re.score_override)
            })),
            report_evaluation: reportParams.filter(p => p.parameter.trim() !== ''),
            feedback: feedback,
            evaluated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
            .from('submissions')
            .update({ evaluation: newEvaluation as unknown as Json })
            .eq('id', selectedSubmission.id!);
        
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

    const addReportParam = () => {
        setReportParams([...reportParams, { id: uuidv4(), parameter: '', score: 0 }]);
    };

    const removeReportParam = (id: string) => {
        setReportParams(reportParams.filter(p => p.id !== id));
    };

    const handleReportParamChange = (id: string, field: 'parameter' | 'score', value: string) => {
        setReportParams(reportParams.map(p => {
            if (p.id === id) {
                return { ...p, [field]: field === 'score' ? (value === '' ? 0 : Number(value)) : value };
            }
            return p;
        }));
    };

    if (loading) return <div className="p-8">Loading evaluation...</div>;
    if (!challenge) return <div className="p-8 text-center">Challenge not found.</div>;
    if (challenge.submissions.length === 0) {
        return (
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <BackButton to={`/batch/${batchId}/level/4/evaluator`} text="Back to Dashboard" />
                <Card className="text-center py-10">
                    <p className="text-gray-500">There are no submissions for this challenge yet.</p>
                </Card>
            </div>
        );
    }
    
    const submittedResults = (selectedSubmission?.results as unknown as SubmittedResult[]) || [];
    const rules = challenge.evaluation_rules as unknown as EvaluationRules;
    const isChallengeEnded = !!challenge.overall_challenges?.ended_at;
    const reportFile = selectedSubmission?.report_file as { name: string; path: string; } | null;
    const downloadFilename = reportFile ? `${challenge.title}_${selectedSubmission?.profiles?.name}_${reportFile.name}`.replace(/[\s/\\?%*:|"<>]/g, '_') : 'report';
    const formInputClasses = "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2 text-sm";
    const formLabelClasses = "block mb-1 text-sm font-medium";

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={`/batch/${batchId}/level/4/evaluator`} text="Back to Dashboard" />
            <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
                 <div>
                    <h1 className="text-3xl font-bold mb-2">{challenge.title}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Evaluation Form</p>
                </div>
            </div>
            
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
                        <nav className="-mb-px flex space-x-4 flex-wrap" aria-label="Tabs">
                            <button onClick={() => setActiveTab('evaluate')} className={`${activeTab === 'evaluate' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Evaluate Submission
                            </button>
                            <button onClick={() => setActiveTab('duplicates')} className={`${activeTab === 'duplicates' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Duplicate Check
                            </button>
                             <button onClick={() => setActiveTab('tier1')} className={`${activeTab === 'tier1' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Tier 1 Submissions
                            </button>
                             <button onClick={() => setActiveTab('tier2')} className={`${activeTab === 'tier2' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Tier 2 Submissions
                            </button>
                             <button onClick={() => setActiveTab('tier3')} className={`${activeTab === 'tier3' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>
                                Tier 3 Submissions
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
                                                            className={`${formInputClasses} w-32`}
                                                            disabled={isChallengeEnded}
                                                        >
                                                            {Object.values(EvaluationResultTier).map(tier => <option key={tier} value={tier}>{tier}</option>)}
                                                        </select>
                                                        <input 
                                                            type="number" 
                                                            placeholder="Score" 
                                                            title="Override Score"
                                                            className={`${formInputClasses} w-24`}
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
                                                            className={`${formInputClasses} flex-grow min-w-40`}
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
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className={formLabelClasses}>Report Parameters</label>
                                                            <span className="text-sm font-semibold">
                                                                Total: {reportParams.reduce((sum, p) => sum + Number(p.score || 0), 0)} / {rules.report.maxScore}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-2 p-3 border rounded-md dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                                                            {reportParams.map((param) => (
                                                                <div key={param.id} className="flex items-center gap-2">
                                                                    <input
                                                                        type="text"
                                                                        placeholder="Parameter name"
                                                                        value={param.parameter}
                                                                        onChange={(e) => handleReportParamChange(param.id, 'parameter', e.target.value)}
                                                                        className={formInputClasses}
                                                                        disabled={isChallengeEnded}
                                                                    />
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Score"
                                                                        value={param.score}
                                                                        onChange={(e) => handleReportParamChange(param.id, 'score', e.target.value)}
                                                                        className={`${formInputClasses} w-24`}
                                                                        disabled={isChallengeEnded}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeReportParam(param.id)}
                                                                        disabled={isChallengeEnded}
                                                                        className="text-gray-500 hover:text-red-500 p-1 disabled:opacity-50"
                                                                        aria-label="Remove parameter"
                                                                    >
                                                                        <TrashIcon />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                            {!isChallengeEnded && (
                                                                <Button type="button" variant="secondary" size="sm" onClick={addReportParam}>
                                                                    + Add Parameter
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {reportUrl && reportFile && (
                                                            <a
                                                                href={reportUrl}
                                                                download={downloadFilename}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2 block"
                                                            >
                                                                Download Submitted Report ({reportFile.name})
                                                            </a>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label htmlFor="feedback" className={formLabelClasses}>Overall Feedback</label>
                                                        <textarea id="feedback" value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} className={formInputClasses} disabled={isChallengeEnded} />
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
                    {activeTab === 'tier1' && challenge && (
                        <TierSubmissionsView tier={ResultTier.TIER_1} submissions={challenge.submissions} />
                    )}
                     {activeTab === 'tier2' && challenge && (
                        <TierSubmissionsView tier={ResultTier.TIER_2} submissions={challenge.submissions} />
                    )}
                     {activeTab === 'tier3' && challenge && (
                        <TierSubmissionsView tier={ResultTier.TIER_3} submissions={challenge.submissions} />
                    )}
                </div>
            </div>
        </div>
    );
};