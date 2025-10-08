import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Profile } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';
import { Button } from '../../components/ui/Button';

export const UserManagement: React.FC = () => {
  const { batchId } = useParams<{ batchId: string }>();
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
      <BackButton to={`/batch/${batchId}/level/4/manager`} text="Back to Dashboard" />
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
                <Link to={`/batch/${batchId}/level/4/import-users`}>
                    <Button className="w-full">Import Users from CSV</Button>
                </Link>
                 <div>
                    <h3 className="font-semibold text-lg">User Onboarding Workflow</h3>
                     <ol className="list-decimal list-inside text-sm space-y-3 mt-2 text-gray-600 dark:text-gray-400">
                        <li>
                            <strong>Import Profiles:</strong> Use the "Import Users from CSV" button to create a master list of participants in the system. This action only creates their profile, not their login.
                        </li>
                        <li>
                           <strong>Account Activation:</strong> Direct participants to the application link. They must use the "Create Account" form with the **same email address** you imported. This allows them to set their own password and activates their account.
                        </li>
                        <li>
                           <strong>Role Management:</strong> After a user's profile exists, you can promote them to 'Manager' or 'Evaluator' by editing their role directly in your Supabase dashboard (`profiles` table).
                        </li>
                    </ol>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};