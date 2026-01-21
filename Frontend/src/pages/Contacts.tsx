import React, { useEffect, useState } from 'react';
import { getContacts } from '../services/api';
import { Loader } from '../components/common/Loader';
import { EmptyState } from '../components/common/EmptyState';
import { formatPhoneNumber } from '../services/whatsapp';
import type { Contact } from '../types/message';

export const Contacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const data = await getContacts();
        setContacts(data);
      } catch (error) {
        console.error('Failed to fetch contacts', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, []);

  if (loading) {
    return <Loader type="contacts" />;
  }

  if (contacts.length === 0) {
    return (
      <div className="p-8">
        <EmptyState title="No contacts found" description="Contacts will appear as messages are received" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Contacts</h1>
        <p className="text-gray-600 dark:text-gray-400">Derived from message history</p>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Phone Number
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Total Messages
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Leads
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Offerings
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Last Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900 dark:text-white">{contact.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{formatPhoneNumber(contact.number)}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{contact.totalMessages}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 rounded-full text-sm font-semibold border border-blue-200 dark:border-blue-800">
                      {contact.leadsCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold border border-green-200 dark:border-green-800">
                      {contact.offeringsCount}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(contact.lastActive).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
