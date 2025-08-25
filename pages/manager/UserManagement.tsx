import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';

const UploadIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);


export const UserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        setError(error.message);
        console.error("Error fetching profiles:", error);
      } else if (data) {
        setProfiles(data as unknown as Profile[]);
      }
      setLoading(false);
    };

    fetchProfiles();
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <BackButton to="/manager" text="Back to Dashboard" />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4">All Organization Members</h2>
             <Card>
                {loading && <p>Loading users...</p>}
                {error && <p className="text-red-500">Error: {error}</p>}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                             <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {profiles.map(profile => (
                                <tr key={profile.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {profile.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{profile.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            profile.role === 'Manager' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                            profile.role === 'Evaluator' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                            'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                        }`}>{profile.role}</span>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
             </Card>
        </div>
        <div>
            <h2 className="text-2xl font-semibold mb-4">Manage Members</h2>
            <Card className="space-y-6">
                <div>
                    <h3 className="font-semibold text-lg">Import Users from CSV</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        To add new members or update existing ones, use the CSV import tool. This will populate the master list of users available for challenges.
                    </p>
                    <div className="mt-4">
                        <Link to="/manager/import-users">
                            <Button><UploadIcon />Import from CSV</Button>
                        </Link>
                    </div>
                </div>
                 <div className="pt-4 border-t dark:border-gray-600">
                    <h3 className="font-semibold text-lg">How It Works</h3>
                     <ol className="list-decimal list-inside text-sm space-y-3 mt-2 text-gray-600 dark:text-gray-400">
                        <li>
                            <strong>Prepare CSV:</strong> Create a CSV file with two columns: `name` and `email`.
                        </li>
                        <li>
                           <strong>Import:</strong> Use the import tool to upload your file. New users will be added, and existing users will have their names updated if needed.
                        </li>
                        <li>
                           <strong>Assign Managers:</strong> After importing, you can manually assign Manager roles by editing their profiles in the Supabase dashboard.
                        </li>
                         <li>
                           <strong>Invite Managers:</strong> Use your Supabase dashboard to send login invitations *only* to users with the 'Manager' role.
                        </li>
                    </ol>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};