import { Database, Tables, Json as DbJson } from './database.types';

// Re-export Json for convenience
export type Json = DbJson;

// Export role enum for convenience in the app
export const Role = {
  MANAGER: 'Manager',
  TRAINEE: 'Trainee',
  EVALUATOR: 'Evaluator',
  MENTOR: 'Mentor'
} as const;
export type Role = (typeof Role)[keyof typeof Role];


// Re-export table types for easier access
export type Profile = Tables<'profiles'>;
export type OverallChallenge = Tables<'overall_challenges'>;
export type SubChallenge = Tables<'sub_challenges'>;
export type Submission = Tables<'submissions'>;


// Enums for evaluation logic
export enum ResultType {
  PATENT = 'Patent',
  NON_PATENT = 'Non-Patent Literature',
}

export enum ResultTier {
  TIER_1 = 'Tier-1',
  TIER_2 = 'Tier-2',
  TIER_3 = 'Tier-3',
}

export enum IncorrectMarking {
  ZERO = 'zero',
  PENALTY = 'penalty',
}

// Type for the 'evaluation_rules' JSONB column in 'sub_challenges'
export interface EvaluationRules {
  tierScores: {
    [ResultTier.TIER_1]: number;
    [ResultTier.TIER_2]: number;
    [ResultTier.TIER_3]: number;
  };
  incorrectMarking: IncorrectMarking;
  incorrectPenalty: number;
  report: {
    enabled: boolean;
    maxScore: number;
  };
}

// Types for the 'results' JSONB column in 'submissions'
export interface SubmittedResult {
  id: string;
  value: string;
  type: ResultType;
  trainee_tier: ResultTier;
}

// Types for the 'evaluation' JSONB column in 'submissions'
export interface ResultEvaluation {
  result_id: string;
  evaluator_tier: ResultTier;
}

export interface Evaluation {
  evaluator_id: string;
  result_evaluations: ResultEvaluation[];
  report_score?: number;
  feedback: string;
  evaluated_at: string;
};

// --- COMPOSITE TYPES for joined data ---

export type SubmissionWithProfile = Submission & {
  profiles: Profile | null;
};

export type SubChallengeWithSubmissions = SubChallenge & {
  submissions: SubmissionWithProfile[];
};

export type OverallChallengeWithSubChallenges = OverallChallenge & {
  sub_challenges: SubChallengeWithSubmissions[];
};

export type SubChallengeWithOverallChallenge = SubChallenge & {
  overall_challenges: Pick<OverallChallenge, 'id' | 'ended_at'> | null;
  submissions: SubmissionWithProfile[];
};
