import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card } from '../components/ui/Card';
import { 
    SubChallenge, 
    Submission, 
    Evaluation, 
    SubmittedResult, 
    EvaluationRules, 
    ResultTier, 
    EvaluationResultTier, 
    IncorrectMarking, 
    ResultType 
} from '../types';

const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-yellow-400"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);

interface LeaderboardEntry {
    id: string;
    name: string;
    score: number;
}

interface SubChallengeLeaderboardData {
    sub_challenge_title: string;
    leaderboard: LeaderboardEntry[];
    highlights: string[];
}

// Helper function to calculate score, moved from other components to make this self-contained.
const calculateScore = (submission: Submission, subChallenge: SubChallenge): number => {
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
};

export const PublicSubChallengeLeaderboard: React.FC = () => {
    const { subChallengeId } = useParams<{ subChallengeId: string }>();
    const [leaderboardData, setLeaderboardData] = useState<SubChallengeLeaderboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchAndProcessLeaderboard = async () => {
            if (!subChallengeId) {
                setError("No sub-challenge ID provided.");
                setLoading(false);
                return;
            }
            setLoading(true);

            // Fetch the sub-challenge and all related submissions with profiles in one call
            const { data: subChallengeData, error: fetchError } = await supabase
                .from('sub_challenges')
                .select('*, submissions(*, profiles(id, name))')
                .eq('id', subChallengeId)
                .single();

            if (fetchError || !subChallengeData) {
                setError("This sub-challenge may not exist or its results are not publicly available.");
                console.error('Fetch Error:', fetchError);
                setLoading(false);
                return;
            }
            
            const subChallenge = subChallengeData as SubChallenge & { submissions: (Submission & { profiles: {id: string; name: string} | null })[] };
            const evaluatedSubmissions = subChallenge.submissions.filter(s => s.evaluation && s.profiles);

            // --- Process Data Client-Side for Highlights ---
            const highlights: string[] = [];
            const resultsMap = new Map<string, { submitter: { name: string, traineeTier: ResultTier, evalTier: EvaluationResultTier }, submittedAt: string }[]>();

            // 1. Group all results by their normalized value and sort them by submission time
            evaluatedSubmissions.forEach(sub => {
                const results = (sub.results || []) as unknown as SubmittedResult[];
                const evaluation = sub.evaluation as unknown as Evaluation;
                for (const result of results) {
                    const normalizedValue = result.value.trim().toLowerCase();
                    const resultEval = evaluation.result_evaluations.find(re => re.result_id === result.id);
                    if (!resultEval) continue;

                    if (!resultsMap.has(normalizedValue)) {
                        resultsMap.set(normalizedValue, []);
                    }
                    resultsMap.get(normalizedValue)!.push({
                        submitter: { name: sub.profiles!.name, traineeTier: result.trainee_tier, evalTier: resultEval.evaluator_tier },
                        submittedAt: result.submitted_at
                    });
                }
            });
            resultsMap.forEach(submitters => submitters.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()));

            // 2. Identify achievements
            let firstCorrectT1SubmitterName: string | null = null;
            const uniqueFinders = new Set<string>();

            for (const [_, submitters] of resultsMap.entries()) {
                // Check for unique correct T1/T2
                if (submitters.length === 1) {
                    const { submitter } = submitters[0];
                    const isCorrectT1 = submitter.traineeTier === ResultTier.TIER_1 && submitter.evalTier === EvaluationResultTier.TIER_1;
                    const isCorrectT2 = submitter.traineeTier === ResultTier.TIER_2 && submitter.evalTier === EvaluationResultTier.TIER_2;
                    if (isCorrectT1 || isCorrectT2) {
                        uniqueFinders.add(submitter.name);
                    }
                }
                
                // Check for first correct T1 among duplicates
                if (!firstCorrectT1SubmitterName && submitters.length > 1) {
                    for (const { submitter } of submitters) {
                        if (submitter.traineeTier === ResultTier.TIER_1 && submitter.evalTier === EvaluationResultTier.TIER_1) {
                            firstCorrectT1SubmitterName = submitter.name;
                            break;
                        }
                    }
                }
            }
            
            if (firstCorrectT1SubmitterName) {
                highlights.push(`${firstCorrectT1SubmitterName} first submitted a correct Tier-1.`);
                uniqueFinders.delete(firstCorrectT1SubmitterName); // Avoid duplicate highlight
            }
            uniqueFinders.forEach(name => {
                highlights.push(`${name} found a unique correct Tier-1/Tier-2.`);
            });


            // 3. Build the leaderboard
            const leaderboardEntries: LeaderboardEntry[] = evaluatedSubmissions.map(sub => ({
                id: sub.trainee_id,
                name: sub.profiles!.name,
                score: calculateScore(sub, subChallenge),
            }));
            
            leaderboardEntries.sort((a, b) => b.score - a.score);
            
            setLeaderboardData({
                sub_challenge_title: subChallenge.title,
                leaderboard: leaderboardEntries,
                highlights,
            });

            setLoading(false);
        };
        fetchAndProcessLeaderboard();
    }, [subChallengeId]);

    if (loading) return <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900"><p className="text-gray-500">Loading leaderboard...</p></div>;
    if (error) return <div className="min-h-screen flex items-center justify-center p-4 bg-red-100 dark:bg-red-900"><Card><p className="text-red-700 dark:text-red-200">{error}</p></Card></div>;
    if (!leaderboardData || !leaderboardData.sub_challenge_title) return <div className="min-h-screen flex items-center justify-center p-4"><p>Sub-challenge not found.</p></div>;

    const { sub_challenge_title, leaderboard, highlights } = leaderboardData;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <main className="w-full max-w-3xl">
                <Card>
                    <div className="text-center mb-6">
                        <div className="flex justify-center items-center gap-3">
                           <TrophyIcon />
                           <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{sub_challenge_title}</h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Public Leaderboard</p>
                    </div>

                    {highlights.length > 0 && (
                        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg space-y-2">
                            <h3 className="font-bold text-center text-green-800 dark:text-green-200 mb-2">Highlights</h3>
                             {highlights.map((note, index) => {
                                const name = note.split(' ')[0];
                                const restOfNote = note.substring(note.indexOf(' '));
                                return (
                                <p key={index} className="text-sm text-green-800 dark:text-green-200 text-center">
                                    <span className="font-bold">{name}</span>{restOfNote} 🎉
                                </p>
                                );
                            })}
                        </div>
                    )}
                    
                    <div className="overflow-x-auto">
                         <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participant</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {leaderboard.map(({ id, name, score }, index) => (
                                    <tr key={id}>
                                        <td className="px-6 py-4 whitespace-nowrap font-bold">{index + 1}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">{name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold">{score} pts</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {leaderboard.length === 0 && (
                            <p className="text-center text-gray-500 py-6">No participants have evaluated submissions for this sub-challenge yet.</p>
                        )}
                    </div>
                </Card>
                 <footer className="text-center mt-4">
                    <p className="text-xs text-gray-500">Tour de Prior Art</p>
                </footer>
            </main>
        </div>
    );
};
