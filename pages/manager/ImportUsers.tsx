import React, { useState } from 'react';
import Papa from 'papaparse';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { TablesInsert } from '../../database.types';

type ParsedUser = { name: string; email: string };

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
);

const AlertTriangleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-red-500"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);


export const ImportUsers: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setMessage(null);
        }
    };

    const handleImport = () => {
        if (!file) {
            setMessage({ type: 'error', text: 'Please select a file to import.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const requiredHeaders = ['name', 'email'];
                const headers = results.meta.fields || [];
                const hasRequiredHeaders = requiredHeaders.every(h => headers.includes(h));

                if (!hasRequiredHeaders) {
                    setMessage({ type: 'error', text: 'CSV must have "name" and "email" columns.' });
                    setLoading(false);
                    return;
                }
                
                const parsedUsers = results.data as ParsedUser[];

                const uniqueUsersByEmail = Array.from(
                    parsedUsers
                        .filter(u => u.email && u.name)
                        .reduce((map, user) => map.set(user.email.toLowerCase().trim(), user), new Map<string, ParsedUser>())
                        .values()
                );
                
                const profilesToUpsert: TablesInsert<'profiles'>[] = uniqueUsersByEmail
                    .map(user => ({
                        email: user.email.toLowerCase().trim(),
                        name: user.name.trim(),
                    }));
                
                if (profilesToUpsert.length === 0) {
                    setMessage({ type: 'error', text: 'No valid user data found in the CSV to import.' });
                    setLoading(false);
                    return;
                }

                const { error } = await supabase
                    .from('profiles')
                    .upsert(profilesToUpsert, { onConflict: 'email' });

                if (error) {
                    setMessage({ type: 'error', text: `Error importing users: ${error.message}` });
                } else {
                    setMessage({ type: 'success', text: `${profilesToUpsert.length} user(s) imported successfully.` });
                }
                setLoading(false);
            },
            error: (err) => {
                setMessage({ type: 'error', text: `Error parsing CSV: ${err.message}`});
                setLoading(false);
            }
        });
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-2xl">
            <BackButton to="/manager/users" text="Back to User Management" />
            <Card>
                <h1 className="text-3xl font-bold mb-2">Import Users from CSV</h1>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Upload a CSV file with `name` and `email` columns to add or update users in bulk.</p>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="csv-import" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            CSV File
                        </label>
                        <input
                            type="file"
                            id="csv-import"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300 dark:hover:file:bg-blue-800/30"
                        />
                         {file && <p className="mt-2 text-xs text-gray-500">Selected file: {file.name}</p>}
                    </div>

                    <div className="pt-2">
                        <Button onClick={handleImport} disabled={loading || !file}>
                            {loading ? 'Importing...' : 'Import Users'}
                        </Button>
                    </div>

                    {message && (
                        <div className={`mt-4 flex items-center p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                            {message.type === 'success' ? <CheckCircleIcon /> : <AlertTriangleIcon />}
                            <span>{message.text}</span>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};
