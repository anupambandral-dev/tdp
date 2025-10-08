import React from 'react';
import { Navigate } from 'react-router-dom';
import { Profile } from '../types';

interface TourDePriorArtIndexProps {
    currentUser: Profile;
}

export const TourDePriorArtIndex: React.FC<TourDePriorArtIndexProps> = ({ currentUser }) => {
    // This component acts as a router to the correct role-based dashboard
    // within the Tour de Prior Art module.
    const rolePath = currentUser.role.toLowerCase();
    return <Navigate to={`/tour-de-prior-art/${rolePath}`} replace />;
};
