import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../supabaseClient';
import { Role } from '../types';

const LogoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-16 w-16 text-blue-500">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <circle cx="11" cy="11" r="3"></circle>
        <line x1="11" y1="8" x2="11" y2="14"></line>
        <line x1="8.5" y1="9.5" x2="13.5" y2="12.5"></line>
        <line x1="8.5" y1="12.5" x2="13.5" y2="9.5"></line>
    </svg>
);

export const LoginPage: React.FC = () => {
    const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For sign-up
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleAuthAction = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        if (authMode === 'signIn') {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) setError(error.message);
        } else {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name,
                        role: Role.TRAINEE, // Default role for new sign-ups
                    },
                },
            });
            if (error) {
                setError(error.message);
            } else {
                setMessage('Sign up successful! Please check your email to verify your account and then sign in.');
            }
        }
        setLoading(false);
    };

    const toggleAuthMode = () => {
        setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn');
        setMessage('');
        setError('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4"><LogoIcon /></div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Tour de Prior Art</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        {authMode === 'signIn' ? 'Sign in to your account' : 'Create a new account'}
                    </p>
                </div>

                <form onSubmit={handleAuthAction} className="space-y-6">
                    {authMode === 'signUp' && (
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Full Name</label>
                            <input
                                id="name"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                                type="text"
                                placeholder="John Doe"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email address</label>
                        <input
                            id="email"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                            type="email"
                            placeholder="your@email.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                     <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
                        <input
                            id="password"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            minLength={6}
                        />
                    </div>
                    <div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Processing...' : (authMode === 'signIn' ? 'Sign In' : 'Sign Up')}
                        </Button>
                    </div>
                </form>

                {message && <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">{message}</p>}
                {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

                <p className="mt-6 text-center text-sm">
                    {authMode === 'signIn' ? "Don't have an account? " : "Already have an account? "}
                    <button onClick={toggleAuthMode} className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                        {authMode === 'signIn' ? 'Sign up' : 'Sign in'}
                    </button>
                </p>
            </Card>
        </div>
    );
};
