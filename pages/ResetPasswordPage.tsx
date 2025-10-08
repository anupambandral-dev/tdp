import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

// Re-using the LogoIcon from LoginPage for consistency
const LogoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-blue-500">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
);

interface ResetPasswordPageProps {
    onResetSuccess: () => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({ onResetSuccess }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        if (password.length < 6) {
            setError('Password should be at least 6 characters long.');
            setLoading(false);
            return;
        }

        // The user object is automatically available from the session
        // that was established by the recovery link.
        const { error } = await supabase.auth.updateUser({ password: password });

        if (error) {
            setError(`Error updating password: ${error.message}`);
        } else {
            setMessage('Your password has been successfully updated. Redirecting to login...');
            onResetSuccess(); // Signal to the parent component that recovery is complete
            // Sign out of the recovery session before redirecting
            await supabase.auth.signOut();
            setTimeout(() => {
                navigate('/');
            }, 3000);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4"><LogoIcon /></div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Set New Password</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        Enter your new password below.
                    </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">New Password</label>
                        <input
                            id="password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            autoComplete="new-password"
                        />
                         <p className="text-xs text-gray-500 mt-1">Password should be at least 6 characters.</p>
                    </div>
                    <div>
                        <Button type="submit" className="w-full" disabled={loading || !!message}>
                            {loading ? 'Updating...' : 'Update Password'}
                        </Button>
                    </div>
                </form>
                
                {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
                {message && <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">{message}</p>}

            </Card>
        </div>
    );
};