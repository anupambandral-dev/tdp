import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';

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
      } else {
        setProfiles(data);
      }
      setLoading(false);
    };

    fetchProfiles();
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8">
      <Link to="/manager" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Management</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold mb-4">All Employees</h2>
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
                                        <div className="flex items-center">
                                            <img className="h-8 w-8 rounded-full" src={profile.avatar_url} alt={profile.name} />
                                            <div className="ml-3">{profile.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{profile.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{profile.role}</span>
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
            <h2 className="text-2xl font-semibold mb-4">Add & Manage Users</h2>
            <Card className="space-y-6">
                <div>
                    <h3 className="font-semibold text-lg">User Workflow</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Employees can now sign up for the application themselves. You can then manage their roles directly in the Supabase dashboard.
                    </p>
                    <ol className="list-decimal list-inside text-sm space-y-2 mt-2">
                        <li>Direct new employees to the application's login page.</li>
                        <li>They should click **"Sign up"** and create an account with their name, email, and a password.</li>
                        <li>Upon successful sign-up, their profile is automatically created with the default role of **'Trainee'**.</li>
                        <li>
                            To change a user's role, go to your Supabase project, navigate to the **Table Editor**, select the `profiles` table, and edit the `role` for that user to `Evaluator` or `Manager` as needed.
                        </li>
                    </ol>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-gray-700 rounded-lg">
                     <h4 className="font-bold text-md text-blue-800 dark:text-blue-200">First-Time Admin Setup</h4>
                     <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        The first account to sign up (likely yours) will also default to 'Trainee'. Please follow step 4 above for your own account to grant yourself 'Manager' privileges. This is a one-time security setup step.
                     </p>
                </div>
                 <a href="https://supabase.com/docs/guides/auth/managing-users" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm block pt-2 border-t dark:border-gray-600">
                    Learn more about user management &rarr;
                </a>
            </Card>
        </div>
      </div>
    </div>
  );
};