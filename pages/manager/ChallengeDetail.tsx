import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { ResultTier, IncorrectMarking, OverallChallenge, SubChallenge, Profile, Submission, OverallChallengeWithSubChallenges, EvaluationRules, SubmittedResult, Evaluation, ResultType, EvaluationResultTier } from '../../types';

interface ChallengeDetailProps {
  currentUser: Profile;
}

const calculateSubChallengeScore = (submission: Submission, subChallenge: SubChallenge) => {
    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    if (!evaluation || !results) return 0;
    
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;
    let totalScore = 0;

    results.forEach(result => {
        const resultEvaluation = evaluation.result_evaluations.find(re => re.result_id === result.id);
        if (resultEvaluation) {
            if (resultEvaluation.score_override != null) {
                totalScore += resultEvaluation.score_override;
            } else {
                if (result.trainee_tier === (resultEvaluation.evaluator_tier as any)) {
                    const resultTypeScores = rules.tierScores[result.type as ResultType];
                    if (resultTypeScores) {
                        totalScore += resultTypeScores[result.trainee_tier as ResultTier] || 0;
                    }
                } else {
                    if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
                        totalScore += rules.incorrectPenalty;
                    }
                }
            }
        }
    });

    if (rules.report.enabled && evaluation.report_score) {
        totalScore += evaluation.report_score;
    }
    return Math.round(totalScore);
}

const ClipboardIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
);


export const ChallengeDetail: React.FC<ChallengeDetailProps> = ({ currentUser }) => {
    const { batchId, challengeId } = useParams();
    const navigate = useNavigate();
    const [challenge, setChallenge] = useState<OverallChallengeWithSubChallenges | null>(null);
    const [trainees, setTrainees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    const fetchChallengeDetails = async () => {
        if (!challengeId) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('overall_challenges')
            .select('*, sub_challenges(*, submissions(*, profiles(id, name, email, role)))')
            .eq('id', challengeId)
            .single<OverallChallengeWithSubChallenges>();
        
        if (error) {
            setError(error.message);
            console.error(error);
        } else if (data) {
            setChallenge(data);
            if (data.trainee_ids.length > 0) {
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('id', data.trainee_ids);

                if (profilesError) {
                    setError(profilesError.message);
                } else if (profilesData) {
                    setTrainees(profilesData as unknown as Profile[]);
                }
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchChallengeDetails();
    }, [challengeId]);

    const handleEndChallenge = async () => {
        if (!challengeId) return;

        const isConfirmed = window.confirm(
            'Are you sure you want to end this challenge? This will close all sub-challenges to new submissions.'
        );

        if (isConfirmed) {
            setLoading(true);
            const { error } = await supabase
                .from('overall_challenges')
                .update({ ended_at: new Date().toISOString() })
                .eq('id', challengeId);
            
            if (error) {
                setError(error.message);
                alert(`Error ending challenge: ${error.message}`);
            } else {
                alert('Challenge ended successfully.');
                // Refetch to get the updated status
                fetchChallengeDetails();
            }
            setLoading(false);
        }
    };

    const handleDeleteChallenge = async () => {
        if (!challengeId) return;

        const isConfirmed = window.confirm(
            'WARNING: Are you sure you want to permanently delete this challenge? This will also delete all of its sub-challenges and submissions. This action cannot be undone.'
        );

        if (isConfirmed) {
            setLoading(true);
            const { error } = await supabase
                .from('overall_challenges')
                .delete()
                .eq('id', challengeId);

            if (error) {
                setError(error.message);
                alert(`Error deleting challenge: ${error.message}`);
                setLoading(false);
            } else {
                alert('Challenge deleted successfully.');
                navigate(`/batch/${batchId}/level/4/manager`);
            }
        }
    };

    const getTraineeScore = (traineeId: string) => {
        if (!challenge) return 0;
        let totalScore = 0;
        challenge.sub_challenges.forEach(sc => {
            const submission = sc.submissions?.find(s => s.trainee_id === traineeId);
            if (submission) {
                totalScore += calculateSubChallengeScore(submission, sc);
            }
        });
        return totalScore;
    };

    const handleExportToCSV = () => {
        if (!challenge) return;

        const exportData: any[] = [];
        const overallScores = new Map<string, number>();
        trainees.forEach(t => {
            overallScores.set(t.id, getTraineeScore(t.id));
        });

        const getResultScore = (result: SubmittedResult, evalResult: any, rules: EvaluationRules) => {
            if (evalResult.score_override != null) {
                return evalResult.score_override;
            }
            if (result.trainee_tier === (evalResult.evaluator_tier as any)) {
                 const resultTypeScores = rules.tierScores[result.type as ResultType];
                 if (resultTypeScores) {
                    return resultTypeScores[result.trainee_tier as ResultTier] || 0;
                 }
            } else {
                if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
                   return rules.incorrectPenalty;
                }
            }
            return 0; // Zero for incorrect marking by default
        };
        
        const getStatus = (traineeTier: ResultTier, evaluatorTier: EvaluationResultTier) => {
            // FIX: Cast to `any` to allow comparing `ResultTier` and `EvaluationResultTier` enum values.
            if (traineeTier === (evaluatorTier as any)) return 'Correct';

            const tierValues: Record<string, number> = { [ResultTier.TIER_1]: 1, [ResultTier.TIER_2]: 2, [ResultTier.TIER_3]: 3 };
            const traineeValue = tierValues[traineeTier];
            const evaluatorValue = tierValues[evaluatorTier];

            if (traineeValue && evaluatorValue) {
                if (evaluatorValue < traineeValue) return 'Upgraded';
                if (evaluatorValue > traineeValue) return 'Downgraded';
            }
            
            if (evaluatorTier === EvaluationResultTier.INVALID || evaluatorTier === EvaluationResultTier.NOT_TIER_3) return 'Invalid';

            return 'Incorrect';
        };


        challenge.sub_challenges.forEach(sc => {
            sc.submissions.forEach(submission => {
                const trainee = trainees.find(t => t.id === submission.trainee_id);
                if (!trainee) return;

                const results = (submission.results as unknown as SubmittedResult[]) || [];
                const evaluation = submission.evaluation as unknown as Evaluation | null;
                const rules = sc.evaluation_rules as unknown as EvaluationRules;
                const subChallengeScore = calculateSubChallengeScore(submission, sc);
                const overallScore = overallScores.get(trainee.id) || 0;

                if (results.length === 0) {
                     exportData.push({
                        'Overall Challenge Name': challenge.name,
                        'Sub-Challenge Name': sc.title,
                        'Sub-Challenge Patent': sc.patent_number,
                        'Participant Name': trainee.name,
                        'Participant Email': trainee.email,
                        'Submitted Result Value': 'N/A - No Result Submitted',
                        'Submitted Result Type': '',
                        "Trainee's Submitted Tier": '',
                        "Evaluator's Final Tier": '',
                        'Evaluation Status': evaluation ? 'Evaluated' : 'Pending',
                        'Result Score': '',
                        'Override Reason': '',
                        'Participant Sub-Challenge Score': subChallengeScore,
                        'Participant Overall Challenge Score': overallScore,
                     });
                } else {
                    results.forEach(result => {
                        const evalResult = evaluation?.result_evaluations.find(re => re.result_id === result.id);
                        exportData.push({
                            'Overall Challenge Name': challenge.name,
                            'Sub-Challenge Name': sc.title,
                            'Sub-Challenge Patent': sc.patent_number,
                            'Participant Name': trainee.name,
                            'Participant Email': trainee.email,
                            'Submitted Result Value': result.value,
                            'Submitted Result Type': result.type,
                            "Trainee's Submitted Tier": result.trainee_tier,
                            "Evaluator's Final Tier": evalResult?.evaluator_tier || 'N/A',
                            'Evaluation Status': evalResult ? getStatus(result.trainee_tier, evalResult.evaluator_tier) : 'Pending',
                            'Result Score': evalResult ? getResultScore(result, evalResult, rules) : 'N/A',
                            'Override Reason': evalResult?.override_reason || '',
                            'Participant Sub-Challenge Score': subChallengeScore,
                            'Participant Overall Challenge Score': overallScore,
                        });
                    });
                }
            });
        });

        const csv = Papa.unparse(exportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${challenge.name}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleCopyPublicLink = () => {
        const link = `${window.location.origin}/#/leaderboard/${challengeId}`;
        navigator.clipboard.writeText(link).then(() => {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy link.');
        });
    };

    if (loading) return <div className="p-8">Loading challenge details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!challenge) return <div className="p-8 text-center">Challenge not found.</div>;

    const leaderboard = trainees
        .map(trainee => ({
            id: trainee.id,
            name: trainee.name,
            score: getTraineeScore(trainee.id),
        }))
        .sort((a, b) => b.score - a.score);
        
    const sortedSubChallenges = [...challenge.sub_challenges].sort((a, b) => 
        a.title.localeCompare(b.title, undefined, { numeric: true })
    );

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to={`/batch/${batchId}/level/4/manager`} text="Back to Dashboard" />

            <Card className="mb-8">
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-bold">{challenge.name}</h1>
                        <p className="text-gray-500 dark:text-gray-400">{challenge.trainee_ids.length} participants</p>
                         {challenge.ended_at && (
                            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mt-2">
                                Challenge ended on {new Date(challenge.ended_at).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                        <Button onClick={handleCopyPublicLink} variant="secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>
                            {linkCopied ? 'Copied!' : 'Copy Public Link'}
                        </Button>
                        <Button onClick={handleExportToCSV} variant="secondary"><ClipboardIcon />Export to CSV</Button>
                        {!challenge.ended_at && (
                             <Button onClick={handleEndChallenge} variant="danger-outline" disabled={loading}>
                                {loading ? 'Ending...' : 'End Challenge'}
                            </Button>
                        )}
                        <Button onClick={handleDeleteChallenge} variant="danger" disabled={loading}>
                           {loading ? 'Deleting...' : 'Delete Challenge'}
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <h2 className="text-2xl font-semibold mb-4">Sub-Challenges</h2>
                    <div className="space-y-4">
                        {sortedSubChallenges.map(sc => (
                             <Card key={sc.id} className="hover:shadow-lg transition-shadow duration-200">
                                <Link to={`/batch/${batchId}/level/4/sub-challenge/${sc.id}`}>
                                    <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400">{sc.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{sc.patent_number}</p>
                                    <p className="text-sm mt-2">{sc.submissions?.length || 0} submissions</p>
                                </Link>
                            </Card>
                        ))}
                        {challenge.sub_challenges.length === 0 && (
                            <Card>
                                <p className="text-center text-gray-500">No sub-challenges have been created yet.</p>
                            </Card>
                        )}
                        {!challenge.ended_at && (
                             <Link to={`/batch/${batchId}/level/4/challenge/${challengeId}/create-sub-challenge`}>
                                <Button className="w-full">
                                    + Add New Sub-Challenge
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
                    <Card>
                        <ul className="space-y-4">
                            {leaderboard.map((trainee, index) => (
                                <li key={trainee.id} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <span className="text-lg font-bold w-8">{index + 1}.</span>
                                        <Link to={`/batch/${batchId}/level/4/challenge/${challenge.id}/trainee/${trainee.id}`} className="font-medium hover:underline">
                                            {trainee.name}
                                        </Link>
                                    </div>
                                    <span className="font-semibold">{trainee.score} pts</span>
                                </li>
                            ))}
                             {leaderboard.length === 0 && (
                                <p className="text-center text-gray-500">No participants yet.</p>
                            )}
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
};
