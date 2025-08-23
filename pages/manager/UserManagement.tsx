import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Profile } from '../../types';
import { supabase } from '../../supabaseClient';
import { Card } from '../../components/ui/Card';
import { BackButton } from '../../components/ui/BackButton';

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
            <h2 className="text-2xl font-semibold mb-4">Setup Instructions</h2>
            <Card className="space-y-6">
                <div>
                    <h3 className="font-semibold text-lg">Managing Your Organization's Users</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        This system is designed to be pre-loaded with a master list of your organization's members. Follow these steps for initial setup and ongoing management.
                    </p>
                    <ol className="list-decimal list-inside text-sm space-y-3 mt-4">
                        <li>
                            <strong>Initial Data Import:</strong> Use your database management tool (like the Supabase dashboard) to import a CSV file with all employee `name` and `email` information into the `profiles` table. This only needs to be done once.
                        </li>
                        <li>
                           <strong>Assign Managers:</strong> After importing, manually edit the `role` field in the `profiles` table for any user who needs to be a Manager. Change their role from 'Trainee' to 'Manager'.
                        </li>
                        <li>
                           <strong>Invite Managers:</strong> Use your database provider's authentication system to send login invitations *only* to the users you designated as Managers. They are the only ones who need initial access.
                        </li>
                         <li>
                           <strong>Evaluator Roles:</strong> A user's role is automatically promoted to 'Evaluator' when a Manager assigns them to a sub-challenge. You do not need to set this manually.
                        </li>
                    </ol>
                </div>
                 <div className="pt-4 border-t dark:border-gray-600">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Once managers are invited, they can log in and begin creating challenges. They will be able to select any user from the master list you imported.
                    </p>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
};