
import { Role, User, Trainee, OverallChallenge, ResultTier, ResultType, IncorrectMarking, OverallChallengeWithSubChallenges } from './types';

export const ALL_EMPLOYEES: User[] = [
  { id: 'user-1', name: 'Alice Manager', email: 'alice@example.com', role: Role.MANAGER, avatar_url: 'https://picsum.photos/seed/user-1/100/100' },
  { id: 'user-2', name: 'Bob Trainee', email: 'bob@example.com', role: Role.TRAINEE, avatar_url: 'https://picsum.photos/seed/user-2/100/100' },
  { id: 'user-3', name: 'Charlie Trainee', email: 'charlie@example.com', role: Role.TRAINEE, avatar_url: 'https://picsum.photos/seed/user-3/100/100' },
  { id: 'user-4', name: 'Diana Evaluator', email: 'diana@example.com', role: Role.EVALUATOR, avatar_url: 'https://picsum.photos/seed/user-4/100/100' },
  { id: 'user-5', name: 'Eve Mentor', email: 'eve@example.com', role: Role.MENTOR, avatar_url: 'https://picsum.photos/seed/user-5/100/100' },
  { id: 'user-6', name: 'Frank Trainee', email: 'frank@example.com', role: Role.TRAINEE, avatar_url: 'https://picsum.photos/seed/user-6/100/100' },
  { id: 'user-7', name: 'Grace Evaluator', email: 'grace@example.com', role: Role.EVALUATOR, avatar_url: 'https://picsum.photos/seed/user-7/100/100' },
  { id: 'user-8', name: 'Heidi Manager', email: 'heidi@example.com', role: Role.MANAGER, avatar_url: 'https://picsum.photos/seed/user-8/100/100' },
];

export const MOCK_TRAINEES: Trainee[] = ALL_EMPLOYEES.filter(u => u.role === Role.TRAINEE).map(u => ({...u, mentorId: 'user-5'}));

const MOCK_EVALUATION_RULES = {
    tierScores: {
      [ResultTier.TIER_1]: 20,
      [ResultTier.TIER_2]: 10,
      [ResultTier.TIER_3]: 5,
    },
    incorrectMarking: IncorrectMarking.PENALTY,
    incorrectPenalty: -5,
    report: {
      enabled: true,
      maxScore: 30,
    },
};

const pastDate = new Date();
pastDate.setDate(pastDate.getDate() - 10);

const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 10);

export const MOCK_CHALLENGES: OverallChallengeWithSubChallenges[] = [
  {
    id: 'oc-1',
    created_at: pastDate.toISOString(),
    name: 'Tour de Prior Art - July 2024 Batch',
    trainee_ids: ['user-2', 'user-3', 'user-6'],
    evaluator_ids: ['user-4', 'user-7'],
    manager_ids: ['user-1'],
    sub_challenges: [
      {
        id: 'sc-1',
        created_at: pastDate.toISOString(),
        overall_challenge_id: 'oc-1',
        title: 'Challenge 1: Semiconductor Innovation',
        patent_number: 'US-10000000-B2',
        summary: 'Find prior art related to the novel manufacturing process described in the patent.',
        claim_focus: 'Claims 1-5 regarding the etching technique.',
        submission_end_time: pastDate.toISOString(),
        evaluation_rules: MOCK_EVALUATION_RULES,
        submissions: [
          {
            id: 'sub-1',
            created_at: new Date(pastDate.getTime() - 86400000 * 2).toISOString(),
            sub_challenge_id: 'sc-1',
            trainee_id: 'user-2',
            submitted_at: new Date(pastDate.getTime() - 86400000).toISOString(),
            results: [
                { id: 'res-1', value: 'US-9876543-B1', type: ResultType.PATENT, trainee_tier: ResultTier.TIER_1 },
                { id: 'res-2', value: 'EP-1234567-A1', type: ResultType.PATENT, trainee_tier: ResultTier.TIER_2 },
                { id: 'res-3', value: '"Advanced Etching", IEEE Conf. 2020', type: ResultType.NON_PATENT, trainee_tier: ResultTier.TIER_2 },
            ],
            report_file: { name: 'bob_report_c1.pdf', path: '#' },
            evaluation: {
              evaluator_id: 'user-4',
              result_evaluations: [
                { result_id: 'res-1', evaluator_tier: ResultTier.TIER_1 }, // Correct
                { result_id: 'res-2', evaluator_tier: ResultTier.TIER_1 }, // Upgraded
                { result_id: 'res-3', evaluator_tier: ResultTier.TIER_3 }, // Downgraded
              ],
              report_score: 28,
              feedback: 'Excellent findings, especially the European patent. The report was well-structured.',
              evaluated_at: new Date(pastDate.getTime() - 3600000).toISOString(),
            },
          },
          {
            id: 'sub-2',
            created_at: new Date(pastDate.getTime() - 172800000 * 2).toISOString(),
            sub_challenge_id: 'sc-1',
            trainee_id: 'user-3',
            submitted_at: new Date(pastDate.getTime() - 172800000).toISOString(),
            results: [
                { id: 'res-4', value: 'US-9123456-B2', type: ResultType.PATENT, trainee_tier: ResultTier.TIER_1 },
            ],
            report_file: { name: 'charlie_report_c1.pdf', path: '#' },
            evaluation: {
              evaluator_id: 'user-4',
              result_evaluations: [
                 { result_id: 'res-4', evaluator_tier: ResultTier.TIER_2 }, // Downgraded
              ],
              report_score: 22,
              feedback: 'Good effort, but the prior art found was only moderately relevant. Focus on claim limitations more.',
              evaluated_at: new Date(pastDate.getTime() - 3600000).toISOString(),
            }
          }
        ],
      },
      {
        id: 'sc-2',
        created_at: pastDate.toISOString(),
        overall_challenge_id: 'oc-1',
        title: 'Challenge 2: Pharmaceutical Compound',
        patent_number: 'US-10000001-B2',
        summary: 'Identify prior art disclosing the core chemical structure.',
        claim_focus: 'The Markush structure in claim 1.',
        submission_end_time: futureDate.toISOString(),
        evaluation_rules: MOCK_EVALUATION_RULES,
        submissions: [
           {
            id: 'sub-3',
            created_at: new Date().toISOString(),
            sub_challenge_id: 'sc-2',
            trainee_id: 'user-2',
            submitted_at: new Date().toISOString(),
            results: [
                { id: 'res-5', value: 'WO-2022012345-A1', type: ResultType.PATENT, trainee_tier: ResultTier.TIER_1 },
            ],
            report_file: { name: 'bob_report_c2.pdf', path: '#' },
          }
        ],
      },
    ],
  },
];
