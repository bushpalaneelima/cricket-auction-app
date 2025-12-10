'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Manager = {
  manager_id: number;
  manager_name: string;
  starting_budget: number;
  current_budget: number;
  email?: string;
};

export default function ManagersPage() {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [newManagerName, setNewManagerName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch managers
  const fetchManagers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .order('manager_id', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setManagers(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  // Add new manager
  const addManager = async () => {
    if (!newManagerName.trim()) {
      alert('Please enter a manager name');
      return;
    }

    if (managers.length >= 8) {
      alert('Maximum 8 managers allowed');
      return;
    }

    const { error } = await supabase.from('managers').insert({
      manager_name: newManagerName.trim(),
      starting_budget: 1000,
      current_budget: 1000,
    });

    if (error) {
      alert('Error adding manager: ' + error.message);
    } else {
      setNewManagerName('');
      fetchManagers();
    }
  };

  return (
    <main className="managers-page" style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Auction Managers</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Add up to 8 managers. Each starts with 1000 points budget.
      </p>

      {/* Add Manager Form */}
      <div style={{ marginBottom: '40px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Enter manager name"
          value={newManagerName}
          onChange={(e) => setNewManagerName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && addManager()}
          style={{
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            flex: 1,
          }}
          disabled={managers.length >= 8}
        />
        <button
          onClick={addManager}
          disabled={managers.length >= 8}
          style={{
            padding: '10px 30px',
            fontSize: '16px',
            backgroundColor: managers.length >= 8 ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: managers.length >= 8 ? 'not-allowed' : 'pointer',
          }}
        >
          Add Manager ({managers.length}/8)
        </button>
      </div>

      {/* Managers Table */}
      {loading ? (
        <p>Loading managers...</p>
      ) : error ? (
        <p style={{ color: 'red' }}>Error: {error}</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5', textAlign: 'left' }}>
              <th style={{ padding: '15px', border: '1px solid #ddd' }}>#</th>
              <th style={{ padding: '15px', border: '1px solid #ddd' }}>Manager Name</th>
              <th style={{ padding: '15px', border: '1px solid #ddd' }}>Starting Budget</th>
              <th style={{ padding: '15px', border: '1px solid #ddd' }}>Current Budget</th>
            </tr>
          </thead>
          <tbody>
            {managers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No managers added yet. Add your first manager above!
                </td>
              </tr>
            ) : (
              managers.map((manager, index) => (
                <tr key={manager.manager_id}>
                  <td style={{ padding: '15px', border: '1px solid #ddd' }}>{index + 1}</td>
                  <td style={{ padding: '15px', border: '1px solid #ddd' }}>{manager.manager_name}</td>
                  <td style={{ padding: '15px', border: '1px solid #ddd' }}>{manager.starting_budget}</td>
                  <td style={{ padding: '15px', border: '1px solid #ddd' }}>{manager.current_budget}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </main>
  );
}