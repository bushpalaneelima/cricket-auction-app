const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase (will read from .env.local)
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Parse CSV manually
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Remove BOM if present
  const firstLine = lines[0].replace(/^\ufeff/, '');
  const headers = firstLine.split(',').map(h => h.trim());
  
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
}

async function importPlayers() {
  console.log('🚀 Starting player import...\n');

  try {
    // Step 1: Parse CSV
    console.log('📖 Reading CSV file...');
    const csvPath = './Crickters list.csv'; // CSV in same folder
    const players = parseCSV(csvPath);
    console.log(`✅ Found ${players.length} players in CSV\n`);

    // Step 2: Clear existing data
    console.log('🗑️  Clearing existing players...');
    
    // Delete from players table first (foreign key constraint)
    const { error: deletePlayersError } = await supabase
      .from('players')
      .delete()
      .neq('player_id', 0); // Delete all
    
    if (deletePlayersError) {
      console.error('❌ Error clearing players:', deletePlayersError);
    } else {
      console.log('✅ Cleared players table');
    }

    // Delete from players_raw
    const { error: deleteRawError } = await supabase
      .from('players_raw')
      .delete()
      .neq('id', 0); // Delete all
    
    if (deleteRawError) {
      console.error('❌ Error clearing players_raw:', deleteRawError);
    } else {
      console.log('✅ Cleared players_raw table\n');
    }

    // Step 3: Get class and type mappings
    console.log('🔍 Loading class and type mappings...');
    
    const { data: classes } = await supabase.from('player_classes').select('*');
    const { data: types } = await supabase.from('player_types').select('*');
    
    const classMap = {};
    classes.forEach(c => { classMap[c.class_name] = c.class_id; });
    
    const typeMap = {};
    types.forEach(t => { typeMap[t.type_name] = t.type_id; });
    
    console.log('Class mappings:', classMap);
    console.log('Type mappings:', typeMap);
    console.log('');

    // Step 4: Import to players_raw (all players)
    console.log('📥 Importing to players_raw...');
    
    const rawPlayers = players.map(p => ({
      cricketer_id: p.cricketer_id,
      cricket_team: p.cricket_team,
      player_name: p.player_name,
      bowling_style: p.bowling_style,
      batting_style: p.batting_style,
      role: p.role,
      class_band: p.class_band,
      base_price: parseInt(p.base_price) || 0,
      country: p.country,
      ipl_team: p.ipl_team,
      ipl_type: p.ipl_type
    }));

    const { data: insertedRaw, error: rawError } = await supabase
      .from('players_raw')
      .insert(rawPlayers)
      .select();

    if (rawError) {
      console.error('❌ Error importing to players_raw:', rawError);
      return;
    }
    console.log(`✅ Imported ${insertedRaw.length} players to players_raw\n`);

    // Step 5: Import to players (filtered - only Active players with valid classes)
    console.log('📥 Importing to players...');
    
    // Filter: Only Active players with classes that exist in auction
    const validClasses = ['Platinum', 'Gold', 'Silver'];
    const activePlayers = players.filter(p => {
      return p.player_status === 'Active' && validClasses.includes(p.class_band);
    });

    console.log(`Filtered: ${activePlayers.length} active players with valid classes (Platinum, Gold, Silver)`);

    const playersToInsert = activePlayers.map(p => ({
      player_name: p.player_name,
      class_id: classMap[p.class_band],
      type_id: typeMap[p.role],
      base_price: parseInt(p.base_price) || 0
    })).filter(p => p.class_id && p.type_id); // Only include if mappings exist

    const { data: insertedPlayers, error: playersError } = await supabase
      .from('players')
      .insert(playersToInsert)
      .select();

    if (playersError) {
      console.error('❌ Error importing to players:', playersError);
      return;
    }

    console.log(`✅ Imported ${insertedPlayers.length} players to players table\n`);

    // Step 6: Show summary
    console.log('📊 IMPORT SUMMARY:');
    console.log('==================');
    console.log(`Total in CSV: ${players.length}`);
    console.log(`Imported to players_raw: ${insertedRaw.length}`);
    console.log(`Imported to players: ${insertedPlayers.length}`);
    console.log('');
    
    // Count by class
    const platinumCount = insertedPlayers.filter(p => p.class_id === classMap['Platinum']).length;
    const goldCount = insertedPlayers.filter(p => p.class_id === classMap['Gold']).length;
    const silverCount = insertedPlayers.filter(p => p.class_id === classMap['Silver']).length;
    
    console.log('By Class:');
    console.log(`  Platinum: ${platinumCount}`);
    console.log(`  Gold: ${goldCount}`);
    console.log(`  Silver: ${silverCount}`);
    console.log('');
    
    // Count by type
    const batsmanCount = insertedPlayers.filter(p => p.type_id === typeMap['Batsman']).length;
    const bowlerCount = insertedPlayers.filter(p => p.type_id === typeMap['Bowler']).length;
    const allRounderCount = insertedPlayers.filter(p => p.type_id === typeMap['All-rounder']).length;
    const wkCount = insertedPlayers.filter(p => p.type_id === typeMap['Wicket Keeper']).length;
    
    console.log('By Role:');
    console.log(`  Batsman: ${batsmanCount}`);
    console.log(`  Bowler: ${bowlerCount}`);
    console.log(`  All-rounder: ${allRounderCount}`);
    console.log(`  Wicket Keeper: ${wkCount}`);
    console.log('');
    
    console.log('✅ Import completed successfully! 🎉');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

// Run the import
importPlayers();
