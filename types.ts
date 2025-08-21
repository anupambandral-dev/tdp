// Corresponds to the 'user_role' enum in Supabase
export enum Role {
  MANAGER = 'Manager',
  TRAINEE = 'Trainee',
  EVALUATOR = 'Evaluator',
  MENTOR = 'Mentor'
}

// Corresponds to the 'profiles' table
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar_url: string;
}

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
}

// Corresponds to the 'submissions' table
export interface Submission {
  id: string;
  created_at: string;
  sub_challenge_id: string;
  trainee_id: string;
  submitted_at: string;
  results: SubmittedResult[];
  report_file?: {
    name: string;
    path: string; // Path in Supabase Storage
  };
  evaluation?: Evaluation;
  profiles?: Profile; // To hold the trainee's profile data
}

// Corresponds to the 'sub_challenges' table
export interface SubChallenge {
  id: string;
  created_at: string;
  overall_challenge_id: string;
  title: string;
  patent_number: string;
  summary: string;
  claim_focus: string;
  submission_end_time: string;
  evaluation_rules: EvaluationRules;
  submissions?: Submission[]; // Fetched separately
}

// Corresponds to the 'overall_challenges' table
export interface OverallChallenge {
  id: string;
  created_at: string;
  name: string;
  manager_ids: string[];
  trainee_ids: string[];
  evaluator_ids: string[];
}