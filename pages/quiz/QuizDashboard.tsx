import React from 'react';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';

export const QuizDashboard: React.FC = () => {
    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <BackButton to="/dashboard" text="Back to Dashboard" />
            <Card className="text-center py-20">
                <h1 className="text-3xl font-bold mb-4">Quiz Section</h1>
                <p className="text-gray-500">This feature is coming soon. Stay tuned!</p>
            </Card>
        </div>
    );
};
