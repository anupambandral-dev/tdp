

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { MOCK_CHALLENGES, ALL_EMPLOYEES } from '../../constants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ResultTier, IncorrectMarking } from '../../types';

export const ChallengeDetail: React.FC = () => {
    const { challengeId } = useParams();
    const challenge = MOCK_CHALLENGES.find(c => c.id === challengeId);

    if (!challenge) {
        return <div className="text-center p-8">Challenge not found.</div>;
    }

    const getTraineeScore = (traineeId: string) => {
        let totalScore = 0;
        challenge.sub_challenges.forEach(sc => {
            const submission = sc.submissions.find(s => s.trainee_id === traineeId);
            if (submission?.evaluation) {
                const rules = sc.evaluation_rules;
                submission.results.forEach(result => {
                    const evaluation = submission.evaluation?.result_evaluations.find(re => re.result_id === result.id);
                    if (evaluation) {
                        if (result.trainee_tier === evaluation.evaluator_tier) {
                            totalScore += rules.tierScores[result.trainee_tier as ResultTier] || 0;
                        } else {
                            if (rules.incorrectMarking === IncorrectMarking.PENALTY) {
                                totalScore += rules.incorrectPenalty;
                            }
                        }
                    }
                });

                if (rules.report.enabled && submission.evaluation?.report_score) {
                    totalScore += submission.evaluation.report_score;
                }
            }
        });
        return Math.round(totalScore);
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <Link to="/manager" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
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
                                    <p>Submissions: {sc.submissions.length} / {challenge.trainee_ids.length}</p>
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
                            {challenge.trainee_ids
                                .map(id => ({ user: ALL_EMPLOYEES.find(e => e.id === id), score: getTraineeScore(id) }))
                                .sort((a, b) => b.score - a.score)
                                .map(({ user, score }, index) => user && (
                                <li key={user.id}>
                                    <Link to={`/manager/challenge/${challenge.id}/trainee/${user.id}`} className="block p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <span className="font-bold w-6 text-center">{index + 1}</span>
                                                <img src={user.avatar_url} alt={user.name} className="w-10 h-10 rounded-full" />
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
