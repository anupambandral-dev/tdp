

import React from 'react';
import { Link } from 'react-router-dom';
import { User, SubChallenge, SubChallengeWithSubmissions } from '../../types';
import { MOCK_CHALLENGES } from '../../constants';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface EvaluatorDashboardProps {
  currentUser: User;
}

export const EvaluatorDashboard: React.FC<EvaluatorDashboardProps> = ({ currentUser }) => {
  const assignedChallenges: SubChallengeWithSubmissions[] = MOCK_CHALLENGES
    .filter(oc => oc.evaluator_ids.includes(currentUser.id))
    .flatMap(oc => oc.sub_challenges);
    
  const getEvaluationStats = (challenge: SubChallengeWithSubmissions) => {
    const totalSubmissions = challenge.submissions.length;
    const evaluatedSubmissions = challenge.submissions.filter(s => s.evaluation?.evaluator_id === currentUser.id).length;
    return { totalSubmissions, evaluatedSubmissions };
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6">Evaluator Dashboard</h1>
      
      <div className="space-y-6">
        {assignedChallenges.map((challenge) => {
            const { totalSubmissions, evaluatedSubmissions } = getEvaluationStats(challenge);
            const progress = totalSubmissions > 0 ? (evaluatedSubmissions / totalSubmissions) * 100 : 0;
            return (
            <Card key={challenge.id}>
              <div className="md:flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">{challenge.title}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Due: {new Date(challenge.submission_end_time).toLocaleDateString()}</p>
                </div>
                <div className="mt-4 md:mt-0 flex items-center space-x-4">
                    <div className="w-48">
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Evaluation Progress ({evaluatedSubmissions}/{totalSubmissions})</p>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                    </div>
                  <Link to={`/evaluator/challenge/${challenge.id}/evaluate`}>
                    <Button>Evaluate</Button>
                  </Link>
                </div>
              </div>
            </Card>
            );
        })}
      </div>
    </div>
  );
};
