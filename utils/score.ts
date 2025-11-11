
import { Submission, SubChallenge, Evaluation, SubmittedResult, EvaluationRules, ResultType, ResultTier, IncorrectMarking } from '../types';

/**
 * Calculates the total score for a given submission based on the sub-challenge's evaluation rules.
 * This function is the single source of truth for scoring across the application.
 * @param submission The submission object, including results and evaluation.
 * @param subChallenge The sub-challenge object, including evaluation rules.
 * @returns The calculated total score, rounded to the nearest integer. Returns 0 if evaluation is not present.
 */
export const calculateScore = (submission: Submission | null | undefined, subChallenge: SubChallenge | null | undefined): number => {
    if (!submission || !subChallenge) {
        return 0;
    }

    const evaluation = submission.evaluation as unknown as Evaluation | null;
    const results = submission.results as unknown as SubmittedResult[] | null;
    const rules = subChallenge.evaluation_rules as unknown as EvaluationRules;

    // An evaluation must be present to have any score.
    if (!evaluation) {
        return 0;
    }

    let totalScore = 0;

    // Calculate score from individual results
    if (results && evaluation.result_evaluations) {
        results.forEach(result => {
            const resultEvaluation = evaluation.result_evaluations.find(re => re.result_id === result.id);
            if (resultEvaluation) {
                if (resultEvaluation.score_override != null) {
                    totalScore += resultEvaluation.score_override;
                } else {
                    if (String(result.trainee_tier) === String(resultEvaluation.evaluator_tier)) {
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
    }

    // Add report score if applicable
    if (rules.report.enabled && evaluation.report_score != null) {
        totalScore += evaluation.report_score;
    }

    return Math.round(totalScore);
};
