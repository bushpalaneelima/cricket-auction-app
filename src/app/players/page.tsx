'use client';

import React, {
  useEffect,
  useState,
  ChangeEvent,
} from 'react';
import { supabase } from '../lib/supabaseClient';

type Player = {
  id: number;
  name: string;
  country: string;
  role: string;
  playerClass: string; // Platinum / Gold / Silver / Bronze / Copper
  basePrice: number;   // 80 / 40 / 20 etc.
};

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedRole, setSelectedRole] = useState<string>('All');

  // 🔹 Fetch players from Supabase ONCE when the page loads
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('players_raw') // 👈 table name in Supabase
        .select('*');

      if (error) {
        console.error('Error loading players:', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      // Map Supabase rows into our Player shape
      const mapped: Player[] =
  (data ?? []).map((row: any, index: number) => ({
    id: row.id ?? index + 1,

    // Try multiple possible column names for each field
    name:
      row.name ??
      row.player_name ??
      row.PlayerName ??
      row.player ??
      '',

    country:
      row.country ??
      row.country_name ??
      row.Country ??
      '',

    role:
      row.role ??
      row.player_role ??
      row.Role ??
      '',

    playerClass:
      row.playerClass ??
      row.class_band ??
      row.classBand ??
      row.player_class ??
      row.band ??
      row.ClassBand ??
      '',

    basePrice: Number(
      row.basePrice ??
        row.base_price ??
        row.price ??
        row.base ??
        row.BasePrice ??
        0
    ),
  }));

      setPlayers(mapped);
      setLoading(false);
    };

    fetchPlayers();
  }, []);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const handleClassChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedClass(e.target.value);
  };

  const handleRoleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
  };

  const filteredPlayers = players.filter((player) => {
    const matchesSearch =
      player.name.toLowerCase().includes(searchText.toLowerCase()) ||
      player.country.toLowerCase().includes(searchText.toLowerCase());

    const matchesClass =
      selectedClass === 'All' || player.playerClass === selectedClass;

    const matchesRole =
      selectedRole === 'All' || player.role === selectedRole;

    return matchesSearch && matchesClass && matchesRole;
  });

  return (
    <main className="players-page">
      <section className="players-header">
        <h1>Auction Players List</h1>
        <p className="subtitle">
          Data is loaded directly from your Supabase <strong>players</strong>{' '}
          table (Class Band + Base Price).
        </p>
      </section>

      <section className="players-filters">
        <div className="filter-item">
          <label htmlFor="search">Search (Name / Country)</label>
          <input
            id="search"
            type="text"
            placeholder="Type to search..."
            value={searchText}
            onChange={handleSearchChange}
          />
        </div>

        <div className="filter-item">
          <label htmlFor="class">Class Band</label>
          <select id="class" value={selectedClass} onChange={handleClassChange}>
            <option value="All">All Classes</option>
            <option value="Platinum">Platinum</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
            <option value="Copper">Copper</option>
          </select>
        </div>

        <div className="filter-item">
          <label htmlFor="role">Role</label>
          <select id="role" value={selectedRole} onChange={handleRoleChange}>
            <option value="All">All Roles</option>
            <option value="Batsman">Batsman</option>
            <option value="Bowler">Bowler</option>
            <option value="All-Rounder">All-Rounder</option>
            <option value="Wicket Keeper">Wicket Keeper</option>
          </select>
        </div>
      </section>

      <section className="players-table-section">
        <table className="players-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Player Name</th>
              <th>Country</th>
              <th>Role</th>
              <th>Class Band</th>
              <th>Base Price</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="no-results">
                  Loading players…
                </td>
              </tr>
            )}

            {!loading && error && (
              <tr>
                <td colSpan={6} className="no-results" style={{ color: 'red' }}>
                  Error loading players: {error}
                </td>
              </tr>
            )}

            {!loading && !error && filteredPlayers.length === 0 && (
              <tr>
                <td colSpan={6} className="no-results">
                  No players match your filters.
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              filteredPlayers.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <td>{player.name}</td>
                  <td>{player.country}</td>
                  <td>{player.role}</td>
                  <td>{player.playerClass}</td>
                  <td>{player.basePrice}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
