import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Papa from 'papaparse';
import { supabase } from '../../supabaseClient';
import { Role } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { BackButton } from '../../components/ui/BackButton';
import { TablesInsert } from '../../database.types';

export const ImportUsers: React.FC = () => {
    const { batchId } = useParams<{ batchId: string }>();
    const navigate = useNavigate();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError(null);
            setSuccessMessage(null);
        }
    };

    const handleImport = () => {
        if (!file) {
            setError('Please select a CSV file to import.');
            return;
        }

        setImporting(true);
        setError(null);
        setSuccessMessage(null);

        Papa.parse<any>(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const requiredColumns = ['name', 'email'];
                const fileColumns = results.meta.fields || [];

                if (!requiredColumns.every(col => fileColumns.includes(col))) {
                    setError(`CSV must contain the following columns: ${requiredColumns.join(', ')}. Optional column: 'role'.`);
                    setImporting(false);
                    return;
                }

                const roleMap = new Map<string, Role>(
                    Object.values(Role).map(r => [r.toLowerCase(), r])
                );

                const profilesToImport: TablesInsert<'profiles'>[] = results.data
                    .map(row => {
                        const name = String(row.name || '').trim();
                        const email = String(row.email || '').trim().toLowerCase();
                        let role: Role = Role.TRAINEE;
                        const roleValue = row.role;
                        
                        if (roleValue && typeof roleValue === 'string' && roleValue.trim() !== '') {
                             const lowerCaseRole = roleValue.trim().toLowerCase();
                             const mappedRole = roleMap.get(lowerCaseRole);
                             if (mappedRole) {
                                 role = mappedRole;
                             }
                        }

                        return { name, email, role };
                    })
                    .filter(profile => profile.name && profile.email);
                
                if (profilesToImport.length === 0) {
                    setError("No valid user data found in the file. Please check for rows with missing names or emails, or an empty file.");
                    setImporting(false);
                    return;
                }

                // FIX: De-duplicate profiles from the CSV before upserting.
                // The DB throws an error if the same conflict target (email) appears multiple times in one upsert command.
                const uniqueProfilesMap = new Map<string, TablesInsert<'profiles'>>();
                profilesToImport.forEach(profile => {
                    if (profile.email) {
                        uniqueProfilesMap.set(profile.email, profile);
                    }
                });
                const uniqueProfilesToImport = Array.from(uniqueProfilesMap.values());
                const duplicatesFound = profilesToImport.length - uniqueProfilesToImport.length;

                const { error: upsertError } = await supabase
                    .from('profiles')
                    .upsert(uniqueProfilesToImport, { onConflict: 'email' });

                if (upsertError) {
                    setError(`Error importing users: ${upsertError.message}`);
                } else {
                    let successMsg = `${uniqueProfilesToImport.length} users were successfully imported or updated.`;
                    if (duplicatesFound > 0) {
                        successMsg += ` ${duplicatesFound} duplicate email(s) were found in the file and were ignored (the last entry for each duplicate was used).`;
                    }
                    setSuccessMessage(successMsg);
                    setFile(null); // Reset file input
                }
                setImporting(false);
            },
            error: (err) => {
                setError(`Error parsing CSV file: ${err.message}`);
                setImporting(false);
            }
        });
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-2xl">
            <BackButton to={`/batch/${batchId}/level/4/users`} text="Back to User Management" />
            <Card>
                <h1 className="text-3xl font-bold mb-4">Import Users from CSV</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Bulk-create or update user profiles by uploading a CSV file. This is useful for adding a new batch of participants at once.
                </p>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <h3 className="font-semibold">CSV File Requirements:</h3>
                    <ul className="list-disc list-inside">
                        <li>The file must have a header row.</li>
                        <li>Required columns: <strong>name</strong>, <strong>email</strong>.</li>
                        <li>Optional column: <strong>role</strong> (Accepted values: 'Manager', 'Trainee', 'Evaluator'. This is case-insensitive. Defaults to 'Trainee' if omitted or invalid).</li>
                        <li>Profiles will be matched and updated based on the <strong>email</strong> address.</li>
                    </ul>
                     <p className="font-semibold pt-2">Important Note:</p>
                    <p>This process only creates user *profiles*. To enable login, users must either sign up themselves using the same email address, or a manager must invite them from the Supabase dashboard.</p>
                </div>
                
                <div className="mt-6">
                    <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Upload CSV File
                    </label>
                    <input
                        id="csv-file"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/20 dark:file:text-blue-300 dark:hover:file:bg-blue-800/30"
                    />
                     {file && <p className="text-xs text-gray-500 mt-1">Selected: {file.name}</p>}
                </div>

                {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
                {successMessage && <p className="mt-4 text-sm text-green-600 dark:text-green-400">{successMessage}</p>}

                <div className="mt-8 flex justify-end">
                    <Button onClick={handleImport} disabled={!file || importing}>
                        {importing ? 'Importing...' : 'Import Users'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};
