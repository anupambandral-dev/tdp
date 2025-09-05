import React, { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { supabase } from '../supabaseClient';

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

type View = 'login' | 'signup' | 'forgotPassword';

export const LoginPage: React.FC = () => {
    const [view, setView] = useState<View>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    
    const clearState = () => {
        setError('');
        setMessage('');
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        clearState();

        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            setError(error.message);
        }
        setLoading(false);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        clearState();

        const { error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    name: name,
                },
            },
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage('Account created! Please check your email for a verification link.');
            setView('login'); // Switch back to login view
        }
        setLoading(false);
    };
    
    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        clearState();
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
             redirectTo: window.location.origin,
        });

        if (error) {
            setError(error.message);
        } else {
            setMessage('Password reset link has been sent to your email.');
            setView('login');
        }
        setLoading(false);
    }
    
    const getTitle = () => {
        switch(view) {
            case 'signup': return 'Create your new account';
            case 'forgotPassword': return 'Reset Your Password';
            case 'login':
            default: return 'Sign in to your account';
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4"><LogoIcon /></div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Tour de Prior Art</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        {getTitle()}
                    </p>
                </div>

                {view === 'login' && (
                     <form onSubmit={handleLogin} className="space-y-6">
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
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Password</label>
                                <button type="button" onClick={() => { setView('forgotPassword'); clearState(); }} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                                    Forgot password?
                                </button>
                            </div>
                            <input
                                id="password"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete={'current-password'}
                            />
                        </div>
                        <div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Signing In...' : 'Sign In'}
                            </Button>
                        </div>
                    </form>
                )}

                {view === 'signup' && (
                    <form onSubmit={handleSignUp} className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Full Name</label>
                            <input
                                id="name"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                                type="text"
                                placeholder="Your Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="name"
                            />
                        </div>
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
                                autoComplete="email"
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
                                autoComplete={'new-password'}
                            />
                             <p className="text-xs text-gray-500 mt-1">Password should be at least 6 characters.</p>
                        </div>
                        <div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </Button>
                        </div>
                    </form>
                )}

                {view === 'forgotPassword' && (
                    <form onSubmit={handleForgotPassword} className="space-y-6">
                         <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-200">Email address</label>
                             <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Enter your email and we will send you a link to reset your password.</p>
                            <input
                                id="email"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 p-2"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Button>
                        </div>
                    </form>
                )}

                {error && <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
                {message && <p className="mt-4 text-center text-sm text-green-600 dark:text-green-400">{message}</p>}

                <div className="mt-6 text-center">
                   {view === 'login' && (
                        <button onClick={() => { setView('signup'); clearState(); }} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                           Don't have an account? Create one
                        </button>
                   )}
                   {view === 'signup' && (
                        <button onClick={() => { setView('login'); clearState(); }} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                           Already have an account? Sign In
                        </button>
                   )}
                   {view === 'forgotPassword' && (
                        <button onClick={() => { setView('login'); clearState(); }} className="text-sm text-blue-600 hover:underline dark:text-blue-400">
                           Back to Login
                        </button>
                   )}
                </div>
            </Card>
        </div>
    );
};
