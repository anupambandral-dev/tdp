import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { ResultTier, IncorrectMarking, OverallChallenge, SubChallenge, Profile, Submission, OverallChallengeWithSubChallenges, EvaluationRules, SubmittedResult, Evaluation } from '../../types';

export const ChallengeDetail: React.FC = () => {
    const { challengeId } = useParams();
    const [challenge, setChallenge] = useState<OverallChallengeWithSubChallenges | null>(null);
    const [trainees, setTrainees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchChallengeDetails = async () => {
            if (!challengeId) return;
            setLoading(true);

            const { data, error } = await supabase
                .from('overall_challenges')
                .select('*, sub_challenges(*, submissions(*, profiles(id, name, avatar_url, email, role)))')
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
        fetchChallengeDetails();
    }, [challengeId]);

    const getTraineeScore = (traineeId: string) => {
        if (!challenge) return 0;
        let totalScore = 0;
        challenge.sub_challenges.forEach(sc => {
            const submission = sc.submissions?.find(s => s.trainee_id === traineeId);
            const evaluation = submission?.evaluation as unknown as Evaluation | null;
            const results = submission?.results as unknown as SubmittedResult[] | null;

            if (evaluation && results) {
                const rules = sc.evaluation_rules as unknown as EvaluationRules;
                results.forEach((result) => {
                    const resultEval = evaluation.result_evaluations.find((re) => re.result_id === result.id);
                    if (resultEval) {
                        if (result.trainee_tier === resultEval.evaluator_tier) {
                            totalScore += rules.tierScores[result.trainee_tier as ResultTier] || 0;
                        } else {
                            if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
                                totalScore += rules.incorrectPenalty;
                            }
                        }
                    }
                });

                if (rules.report.enabled && evaluation?.report_score) {
                    totalScore += evaluation.report_score;
                }
            }
        });
        return Math.round(totalScore);
    };

    if (loading) return <div className="p-8">Loading challenge details...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
    if (!challenge) return <div className="text-center p-8">Challenge not found.</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/manager" text="Back to Dashboard" />
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">{challenge.name}</h1>
                <Link to={`/manager/challenge/${challenge.id}/create-sub-challenge`}>
                    <Button>+ Add Sub-Challenge</Button>
                </Link>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <h2 className="text-2xl font-semibold">Sub-Challenges</h2>
                    {challenge.sub_challenges.length > 0 ? challenge.sub_challenges.map(sc => (
                        <Link to={`/manager/sub-challenge/${sc.id}`} key={sc.id} className="block hover:shadow-lg transition-shadow duration-200 rounded-lg">
                            <Card className="h-full">
                                <h3 className="text-xl font-semibold text-blue-600 dark:text-blue-400">{sc.title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Patent: {sc.patent_number}</p>
                                <p className="mt-2 text-gray-700 dark:text-gray-300">{sc.summary}</p>
                                <div className="mt-4 flex justify-between items-center text-sm">
                                    <p>Submissions: {sc.submissions?.length || 0} / {challenge.trainee_ids.length}</p>
                                    <p>End Time: {new Date(sc.submission_end_time).toLocaleString()}</p>
                                </div>
                            </Card>
                        </Link>
                    )) : (
                        <Card>
                            <p className="text-center text-gray-500">No sub-challenges have been created yet.</p>
                        </Card>
                    )}
                </div>
                
                <div>
                    <h2 className="text-2xl font-semibold mb-6">Trainee Leaderboard</h2>
                    <Card>
                        <ul className="space-y-1">
                            {trainees
                                .map(user => ({ user, score: getTraineeScore(user.id) }))
                                .sort((a, b) => b.score - a.score)
                                .map(({ user, score }, index) => (
                                <li key={user.id}>
                                    <Link to={`/manager/challenge/${challenge.id}/trainee/${user.id}`} className="block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <span className="font-bold w-6 text-center">{index + 1}</span>
                                                <img src={user.avatar_url || ''} alt={user.name} className="w-10 h-10 rounded-full" />
                                                <span>{user.name}</span>
                                            </div>
                                            <span className="font-semibold text-lg">{score} pts</span>
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
};