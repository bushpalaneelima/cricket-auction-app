'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function UserManualPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('platform');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      padding: '20px',
      position: 'relative',
    }}>
      {/* Watermark */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        fontSize: '100px',
        fontWeight: 'bold',
        color: 'rgba(255, 255, 255, 0.03)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 0,
        userSelect: 'none',
        lineHeight: '1.5',
      }}>
        NB BLUE STUDIOS<br/>
        NB BLUE STUDIOS<br/>
        NB BLUE STUDIOS
      </div>

      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(2, 8, 75, 0.2)',
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
          color: 'white',
          padding: '30px 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h1 style={{ fontSize: '32px', margin: 0, marginBottom: '5px' }}>
              📖 User Manual
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.9, margin: 0 }}>
              Game of Gambits - Strategic Decision Simulation
            </p>
          </div>
          <button
            onClick={() => router.push('/home')}
            style={{
              padding: '10px 20px',
              background: 'white',
              color: '#02084b',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            ← Back
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid #eee',
          background: '#f8f9fa',
        }}>
          {[
            { id: 'platform', label: '🖥️ Platform Guide', icon: '🖥️' },
            { id: 'rules', label: '📜 Rules & Regulations', icon: '📜' },
            { id: 'scoring', label: '📊 Scoring System', icon: '📊' },
            { id: 'analysis', label: '📈 Analysis Guide', icon: '📈' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '15px 10px',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#02084b' : '#666',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #02084b' : '3px solid transparent',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          padding: '40px',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}>
          {activeTab === 'platform' && <PlatformGuide />}
          {activeTab === 'rules' && <RulesRegulations />}
          {activeTab === 'scoring' && <ScoringSystem />}
          {activeTab === 'analysis' && <AnalysisGuide />}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '2px solid #eee',
          padding: '20px 40px',
          textAlign: 'center',
          background: '#f8f9fa',
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>
            Powered by{' '}
            <a 
              href="https://nbbluestudios.com" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#02084b', 
                fontWeight: 'bold',
                textDecoration: 'none',
                borderBottom: '2px solid #02084b'
              }}
            >
              nbbluestudios.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Section Components

function PlatformGuide() {
  return (
    <div>
      <h2 style={{ color: '#02084b', fontSize: '28px', marginBottom: '20px' }}>
        Platform Guide
      </h2>

      {/* Getting Started */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🚀 Getting Started
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Login Process:</strong> Use your registered email to sign in</p>
          <p><strong>Dashboard Overview:</strong> Access all features from the home page</p>
          <p><strong>Role Types:</strong></p>
          <ul>
            <li><strong>Admin:</strong> Can create auctions, control auction flow, view all auctions</li>
            <li><strong>Participant:</strong> Can bid if selected for an auction</li>
            <li><strong>Admin as Participant:</strong> Admins can also participate and bid if selected</li>
          </ul>
        </div>
      </section>

      {/* Auction Lobby */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🎯 Auction Lobby
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Joining an Auction:</strong> Admin selects participants when creating auction</p>
          <p><strong>"I'm Ready" Button:</strong> Click when you're ready to start</p>
          <p><strong>Waiting Phase:</strong> All participants must mark ready before starting</p>
          <p><strong>Admin Controls:</strong> "Start Auction" button appears when all participants are ready</p>
        </div>
      </section>

      {/* Main Auction Screen */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🖥️ Main Auction Screen
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '15px' }}>
          Left Panel (Main Screen)
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Timer:</strong> Large number counting down from 30 to 0</li>
          <li><strong>Player Info:</strong> Name, country, role, class, base price</li>
          <li><strong>Current Bid Display:</strong> Shows highest bid and bidder name</li>
          <li><strong>Bid Button:</strong> Appears only if you're a participant</li>
          <li><strong>Admin Controls:</strong> Pause/Resume, Skip player (admins only)</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '15px' }}>
          Right Panel (Your Team) - Participants Only
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Budget Display:</strong> Current/Starting budget</li>
          <li><strong>Players Count:</strong> Shows X / 15 players</li>
          <li><strong>Team Requirements:</strong> Visual indicators for batsmen, bowlers, all-rounders, wicket keepers</li>
          <li><strong>Squad List:</strong> All players you've purchased with prices</li>
        </ul>
      </section>

      {/* How to Bid */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          💰 How to Bid
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <ol style={{ paddingLeft: '20px' }}>
            <li>Wait for a player you want to appear on screen</li>
            <li>Check the bid amount shown on the button</li>
            <li>Click the blue "BID [AMOUNT] POINTS" button</li>
            <li>Button turns grey and shows "BIDDING..." for 3 seconds</li>
            <li>Timer resets to 30 seconds after your bid</li>
            <li>Other participants can now place higher bids</li>
          </ol>
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: '#d1ecf1', 
            borderLeft: '4px solid #0c5460', 
            borderRadius: '4px' 
          }}>
            💡 <strong>Smart Protection:</strong> The system prevents you from bidding if it would make completing your team impossible!
          </div>
        </div>
      </section>

      {/* Player Outcomes */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          ✅ Player Outcomes
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Player Sold:</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Automatically sold when timer hits 0</li>
            <li>Green message: "🎉 SOLD to [Team] for [Amount] pts!"</li>
            <li>Displays for 5 seconds</li>
            <li>Next player loads automatically</li>
          </ul>
          
          <p style={{ marginTop: '15px' }}><strong>Unsold Players:</strong></p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>If no bids placed, player marked UNSOLD</li>
            <li>Message: "⏭️ UNSOLD - Moving to next player..."</li>
            <li>Platinum/Gold unsold → Downgraded one class and re-auctioned</li>
            <li>Silver unsold → Added to Round 2 pool</li>
          </ul>
        </div>
      </section>

      {/* Admin Controls */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          👑 Admin Controls
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>⏸️ Pause/Resume:</strong> Stops timer for breaks or discussions</p>
          <p><strong>⏭️ Skip Player:</strong> Marks current player as sold/unsold and moves to next</p>
          <p><strong>🏁 End Round 1:</strong> Completes Round 1 early (use when needed)</p>
          <p><strong>🎯 Filters:</strong> Jump to specific class/role category</p>
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: '#fff3cd', 
            borderLeft: '4px solid #ffc107', 
            borderRadius: '4px' 
          }}>
            ⚠️ <strong>Important:</strong> Admins can only place bids if they were selected as participants in the auction!
          </div>
        </div>
      </section>

      {/* Round 2 */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🔄 Round 2 Selection
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <ol style={{ paddingLeft: '20px' }}>
            <li>After Round 1 ends, admin opens Round 2 selection</li>
            <li>Access "Round 2 Select" from home page</li>
            <li>Choose up to 5 unsold players you want</li>
            <li>Click on player cards to select/deselect</li>
            <li>Once selected, other participants cannot select that player (locked)</li>
            <li>Green checkmark shows your selections</li>
            <li>Red lock shows players selected by others</li>
            <li>Admin starts Round 2 auction when ready</li>
            <li>Selected players auctioned at base price: 0 points (FREE)</li>
          </ol>
        </div>
      </section>

      {/* Tips */}
      <section>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          💡 Pro Tips
        </h3>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>Click the bid button quickly - competition is fast!</li>
          <li>Always watch your remaining budget in the right panel</li>
          <li>Monitor team requirements - system prevents illegal teams</li>
          <li>Plan your strategy before auction starts</li>
          <li>Watch competitors' budgets and team needs</li>
          <li>Don't overspend on early players</li>
          <li>Save budget for critical roles (wicket keepers, all-rounders)</li>
        </ul>
      </section>
    </div>
  );
}

function RulesRegulations() {
  return (
    <div>
      <h2 style={{ color: '#02084b', fontSize: '28px', marginBottom: '20px' }}>
        Rules & Regulations
      </h2>

      {/* Basic Setup */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🎯 Basic Setup
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Total Participants:</strong> 12 managers per tournament</p>
          <p><strong>Player Pool:</strong> 120 total players available</p>
          <p><strong>Starting Budget:</strong> 1000 points per manager</p>
          <p><strong>Team Size:</strong> Minimum 11 players, Maximum 15 players</p>
          <p><strong>Auction Schedule:</strong> Scheduled by admin</p>
        </div>
      </section>

      {/* Player Classification */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          💎 Player Classification
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
            Three Player Classes:
          </h4>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Platinum Players:</strong> Base price 80 points</li>
            <li><strong>Gold Players:</strong> Base price 40 points</li>
            <li><strong>Silver Players:</strong> Base price 20 points</li>
          </ul>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '15px' }}>
            Four Role Types per Class:
          </h4>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Batsman</li>
            <li>Bowler</li>
            <li>All-rounder</li>
            <li>Wicket Keeper</li>
          </ul>
        </div>
      </section>

      {/* Team Requirements */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          👥 Mandatory Team Requirements
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Team Size:</strong> Between 11 and 15 players</p>
          <p><strong>Bowling Options:</strong> Minimum 5 players who can bowl (Bowlers or All-rounders)</p>
          <p><strong>Wicket Keeper:</strong> At least 1 wicket keeper required</p>
          
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            background: '#f8d7da', 
            borderLeft: '4px solid #dc3545', 
            borderRadius: '4px' 
          }}>
            ⚠️ <strong>Critical:</strong> The system will not allow you to complete your auction if you don't meet these minimum requirements. Plan accordingly!
          </div>
        </div>
      </section>

      {/* Bidding Rules */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🎯 Bidding Rules
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Bid Increments:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Up to 100 points:</strong> Minimum increment of 5 points</li>
          <li><strong>101-200 points:</strong> Minimum increment of 10 points</li>
          <li><strong>Above 200 points:</strong> Minimum increment of 20 points</li>
        </ul>

        <div style={{ paddingLeft: '20px', lineHeight: '1.8', marginTop: '15px' }}>
          <p><strong>Jump Bidding:</strong> Allowed! You can bid higher than minimum increment (e.g., bid 50 when current is 20)</p>
          <p><strong>Initial Bidding Process:</strong> First 2 managers start bidding against each other. When one drops, the 3rd manager can join the bidding war</p>
          <p><strong>Timer Mechanism:</strong> 30 seconds per player. Highest bid when timer reaches 0 wins the player</p>
          <p><strong>Unsold Players:</strong> Platinum and Gold class unsold players are downgraded one class and re-auctioned at the lower base price</p>
        </div>
      </section>

      {/* Auction Order */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          📋 Auction Order
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>First Phase:</strong> Captains of all 10 teams are auctioned first</p>
          <p><strong>Class Order:</strong> Platinum → Gold → Silver</p>
          <p><strong>Within Each Class:</strong> Batsmen → Bowlers → All-rounders → Wicket Keepers</p>
          <p style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
            Example: All Platinum Batsmen are auctioned, then all Platinum Bowlers, then Platinum All-rounders, etc.
          </p>
        </div>
      </section>

      {/* Unsold Mechanism */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          ⏭️ Unsold Player Mechanism
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Platinum Unsold:</strong> Downgraded to Gold class, re-auctioned at Gold base price (6 points)</p>
          <p><strong>Gold Unsold:</strong> Downgraded to Silver class, re-auctioned at Silver base price (4 points)</p>
          <p><strong>Silver Unsold:</strong> Goes into Round 2 selection pool</p>
          <p style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
            Note: Role (Batsman, Bowler, etc.) does not change, only the class changes
          </p>
        </div>
      </section>

      {/* Round 2 */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🔄 Round 2 Auction
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>Selection Phase:</strong> After Round 1, each manager can select up to 5 unsold players</p>
          <p><strong>Selection Method:</strong> First-come-first-served. Once a player is selected, others cannot choose them</p>
          <p><strong>Base Price:</strong> 0 points (FREE auction - players start at 0)</p>
          <p><strong>Player Classes:</strong> Classes do not matter in Round 2</p>
          <p><strong>Auction Order:</strong> Random order (not organized by class or role)</p>
          <p><strong>Purpose:</strong> Give managers a chance to fill gaps in their teams with remaining budget</p>
        </div>
      </section>

      {/* Prizes */}
      <section>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🏆 Prizes & Competition
        </h3>
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <p><strong>1st Place:</strong> Cash prize (amount announced by organizer)</p>
          <p><strong>2nd Place:</strong> Cash prize</p>
          <p><strong>3rd Place:</strong> Cash prize</p>
          <p><strong>Consolation Prizes:</strong> For other participants</p>
          <p style={{ marginTop: '15px', fontStyle: 'italic', color: '#666' }}>
            Final rankings are determined by total points scored by your team based on actual player performance in matches
          </p>
        </div>
      </section>
    </div>
  );
}

function ScoringSystem() {
  return (
    <div>
      <h2 style={{ color: '#02084b', fontSize: '28px', marginBottom: '20px' }}>
        Scoring System
      </h2>

      <p style={{ marginBottom: '30px', lineHeight: '1.8', color: '#666' }}>
        Points are calculated based on actual player performance in real matches. All bonuses use exponential formulas to reward exceptional performances.
      </p>

      {/* Batting */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🏏 Batting Points
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Basic Scoring:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Each run:</strong> 1 point</li>
          <li><strong>Each four:</strong> 1 bonus point (total 5 points for a boundary)</li>
          <li><strong>Each six:</strong> 2 bonus points (total 8 points for a six)</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Consecutive Boundaries Bonus (Exponential):
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>3 consecutive boundaries: 10 bonus points</li>
          <li>4 consecutive boundaries: 20 bonus points</li>
          <li>5 consecutive boundaries: 40 bonus points</li>
          <li>6 consecutive boundaries: 80 bonus points</li>
        </ul>
        <p style={{ paddingLeft: '40px', fontStyle: 'italic', color: '#666' }}>
          Formula: 10 × 2^(n-3) where n = number of consecutive boundaries
        </p>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Milestone Bonus (Exponential):
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>25 runs: 5 bonus points</li>
          <li>50 runs: 10 bonus points</li>
          <li>75 runs: 20 bonus points</li>
          <li>100 runs: 40 bonus points</li>
          <li>125 runs: 80 bonus points</li>
          <li>150 runs: 160 bonus points</li>
        </ul>
        <p style={{ paddingLeft: '40px', fontStyle: 'italic', color: '#666' }}>
          Formula: 5 × 2^(n-1) where n = milestone number (1st, 2nd, 3rd...)
        </p>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Strike Rate Points (Not applicable for bowlers, no minimum balls):
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>SR &lt; 60: -40 points</li>
          <li>SR 60-89: -20 points</li>
          <li>SR 90-119: 0 points</li>
          <li>SR 120-149: +20 points</li>
          <li>SR ≥ 150: +40 points</li>
        </ul>
      </section>

      {/* Bowling */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🎯 Bowling Points
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Basic Scoring:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Each wicket:</strong> 25 points</li>
          <li><strong>Each maiden over:</strong> 50 points</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Multiple Wickets Bonus (Exponential):
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>2 wickets: 20 bonus points</li>
          <li>3 wickets: 40 bonus points</li>
          <li>4 wickets: 80 bonus points</li>
          <li>5 wickets: 160 bonus points</li>
          <li>6+ wickets: 320 bonus points</li>
        </ul>
        <p style={{ paddingLeft: '40px', fontStyle: 'italic', color: '#666' }}>
          Formula: 20 × 2^(n-2) where n = wickets after the first one
        </p>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Special Bowling Achievements:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Hat-trick:</strong> 100 bonus points</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Economy Rate Points (Not applicable for batsmen, no minimum overs):
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>ER ≤ 3.0: +80 points</li>
          <li>ER 3.1-4.5: +40 points</li>
          <li>ER 4.6-5.5: +20 points</li>
          <li>ER 5.6-6.5: 0 points</li>
          <li>ER 6.6-7.5: -20 points</li>
          <li>ER 7.6-9.0: -40 points</li>
          <li>ER &gt; 9.0: -80 points</li>
        </ul>
      </section>

      {/* Fielding */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🧤 Fielding Points
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Basic Fielding:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Each catch:</strong> 25 points</li>
          <li><strong>Each stumping:</strong> 25 points</li>
          <li><strong>Each run out:</strong> 25 points (awarded to both thrower and fielder who removes bails)</li>
          <li><strong>Direct hit run out:</strong> 25 points (single player gets full credit)</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Multiple Dismissals Bonus (Exponential):
        </h4>
        <p style={{ paddingLeft: '40px', marginBottom: '10px' }}>
          Total dismissals in a match (catches + stumpings + run outs):
        </p>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>2 dismissals: 10 bonus points</li>
          <li>3 dismissals: 20 bonus points</li>
          <li>4 dismissals: 40 bonus points</li>
          <li>5 dismissals: 80 bonus points</li>
        </ul>
        <p style={{ paddingLeft: '40px', fontStyle: 'italic', color: '#666' }}>
          Formula: 10 × 2^(X-2) where X = total dismissals in the match
        </p>
      </section>

      {/* Special Awards */}
      <section>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🏆 Special Awards
        </h3>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Man of the Match:</strong> 100 points</li>
        </ul>
      </section>

      {/* Summary Note */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        background: '#e7f3ff', 
        borderLeft: '4px solid #0066cc', 
        borderRadius: '4px' 
      }}>
        <p style={{ margin: 0, lineHeight: '1.8' }}>
          <strong>Key Principle:</strong> The scoring system rewards consistent performance with base points and exceptional performances with exponential bonuses. This creates strategic depth as managers must balance reliable performers with high-risk, high-reward players.
        </p>
      </div>
    </div>
  );
}

function AnalysisGuide() {
  return (
    <div>
      <h2 style={{ color: '#02084b', fontSize: '28px', marginBottom: '20px' }}>
        Analysis Guide
      </h2>

      <p style={{ marginBottom: '30px', lineHeight: '1.8', color: '#666' }}>
        Strategic framework for decision-making, analysis, and optimization in the auction simulation.
      </p>

      {/* Pre-Auction Strategy */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          📋 Pre-Auction Strategy
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Budget Allocation Framework:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Rule of Thirds:</strong> Don't spend more than 30% (300 points) on your first 3 players</li>
          <li><strong>Reserve Strategy:</strong> Keep 100-150 points for Round 2 opportunities</li>
          <li><strong>Critical Roles Budget:</strong> Allocate 150-200 points specifically for Wicket Keepers and All-rounders (scarce resources)</li>
          <li><strong>Minimum Team Cost:</strong> Plan for at least 60 points per remaining player to complete your team</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Player Valuation Methods:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Historical Performance:</strong> Analyze past season points per match average</li>
          <li><strong>Role Scarcity:</strong> Fewer quality Wicket Keepers = willing to pay 20-30% premium</li>
          <li><strong>Recent Form:</strong> Weight last 5 matches 60%, overall career 40%</li>
          <li><strong>Match-ups:</strong> Consider upcoming fixtures and player strengths against specific opponents</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Team Composition Planning:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Batting Depth:</strong> Target 6-7 specialist batsmen for consistency</li>
          <li><strong>Bowling Strength:</strong> Ensure 5+ bowling options including 2-3 specialists</li>
          <li><strong>All-rounder Premium:</strong> All-rounders provide flexibility - worth 15-20% premium over base price</li>
          <li><strong>Wicket Keeper Strategy:</strong> Quality WK is non-negotiable - budget accordingly</li>
        </ul>
      </section>

      {/* Risk vs Reward */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          ⚖️ Risk vs. Reward Analysis
        </h3>
        
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
            High-Value Players (80+ points):
          </h4>
          <p><strong>Pros:</strong> Consistent point scorers, proven performance, team captain material</p>
          <p><strong>Cons:</strong> Expensive, limits budget flexibility, injury risk = large loss</p>
          <p><strong>Strategy:</strong> Acquire 1-2 maximum, ensure remaining budget can complete team</p>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
            Mid-Tier Players (20-50 points):
          </h4>
          <p><strong>Pros:</strong> Best value for money, balanced risk/reward, flexibility to build around them</p>
          <p><strong>Cons:</strong> Less guaranteed performance, higher variance</p>
          <p><strong>Strategy:</strong> Core of your team should be 6-8 mid-tier players</p>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
            Round 2 Strategy (0 point base):
          </h4>
          <p><strong>Pros:</strong> Free base price, low-risk experimentation, fills gaps economically</p>
          <p><strong>Cons:</strong> Lower quality players generally, limited selection</p>
          <p><strong>Strategy:</strong> Use for bench depth and role-specific needs (backup WK, extra bowler)</p>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
            Opportunity Cost Principle:
          </h4>
          <p>Every 10 points spent on one player is 10 points NOT available for another. Always ask: "Is this player worth more than 2-3 mid-tier alternatives?"</p>
        </div>
      </section>

      {/* Real-time Decision Making */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          ⚡ During Auction: Real-Time Decision Making
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Live Budget Tracking:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>Maintain mental spreadsheet of: Current budget, players needed, minimum cost to complete</li>
          <li>Calculate after each bid: "Can I still field a complete team if I win this player?"</li>
          <li>Use the right panel display to verify team requirements in real-time</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Competitor Monitoring:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Budget Watch:</strong> Track who's running low on points - they'll drop out of bidding wars</li>
          <li><strong>Need Assessment:</strong> If competitor needs a WK and only 2 left, expect aggressive bidding</li>
          <li><strong>Pattern Recognition:</strong> Notice if competitors consistently overbid on certain player types</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Walk-Away Price:
        </h4>
        <p style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          Set a maximum price before bidding starts. Stick to it. Emotional bidding destroys budget discipline.
        </p>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Strategic Non-Bidding:
        </h4>
        <p style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          Sometimes the best bid is no bid. Let competitors drain budgets on early players. More opportunities come later at better value.
        </p>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Adaptive Strategy:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>If early players go cheap → Buy more premium players</li>
          <li>If early players go expensive → Pivot to value strategy, target mid-tier</li>
          <li>If WKs going high → Consider securing yours early or plan Round 2 backup</li>
        </ul>
      </section>

      {/* Team Composition */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🎯 Team Composition Optimization
        </h3>
        
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
            Minimum Requirements vs. Optimal Balance:
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'left' }}>Role</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Minimum</th>
                <th style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>Optimal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>Batsmen</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>3</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>5-6</td>
              </tr>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>Bowlers</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>3</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>4-5</td>
              </tr>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>All-rounders</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>2</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>3-4</td>
              </tr>
              <tr>
                <td style={{ padding: '10px', border: '1px solid #dee2e6' }}>Wicket Keepers</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>1</td>
                <td style={{ padding: '10px', border: '1px solid #dee2e6', textAlign: 'center' }}>1-2</td>
              </tr>
            </tbody>
          </table>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
            Captain Selection:
          </h4>
          <p>While all players score equally, having a recognized captain (auctioned first) often provides psychological confidence boost and team identity.</p>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
            Bench Strength:
          </h4>
          <p>Target 13-14 players. Provides insurance against injuries/poor form while maintaining budget efficiency.</p>
        </div>
      </section>

      {/* Common Pitfalls */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          ⚠️ Common Pitfalls to Avoid
        </h3>
        
        <div style={{ 
          padding: '20px', 
          background: '#fff3cd', 
          borderLeft: '4px solid #ffc107', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <h4 style={{ color: '#856404', marginBottom: '10px' }}>1. Early Overspending</h4>
          <p style={{ margin: 0, lineHeight: '1.8' }}>
            <strong>Mistake:</strong> Spending 400+ points on first 3-4 players<br/>
            <strong>Consequence:</strong> Forced to fill remaining spots with minimum-price players<br/>
            <strong>Solution:</strong> Stick to 30% rule, show discipline in early rounds
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          background: '#fff3cd', 
          borderLeft: '4px solid #ffc107', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <h4 style={{ color: '#856404', marginBottom: '10px' }}>2. Ignoring Team Requirements</h4>
          <p style={{ margin: 0, lineHeight: '1.8' }}>
            <strong>Mistake:</strong> Buying 8 batsmen and only 2 bowlers<br/>
            <strong>Consequence:</strong> System blocks team completion, scramble in Round 2<br/>
            <strong>Solution:</strong> Check right panel constantly, prioritize scarce roles early
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          background: '#fff3cd', 
          borderLeft: '4px solid #ffc107', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <h4 style={{ color: '#856404', marginBottom: '10px' }}>3. Emotional Bidding</h4>
          <p style={{ margin: 0, lineHeight: '1.8' }}>
            <strong>Mistake:</strong> Overbidding on favorite players regardless of value<br/>
            <strong>Consequence:</strong> Poor budget allocation, weaker overall team<br/>
            <strong>Solution:</strong> Set walk-away prices, treat it as analytical exercise
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          background: '#fff3cd', 
          borderLeft: '4px solid #ffc107', 
          borderRadius: '4px',
          marginBottom: '15px'
        }}>
          <h4 style={{ color: '#856404', marginBottom: '10px' }}>4. Ignoring Competitor Budgets</h4>
          <p style={{ margin: 0, lineHeight: '1.8' }}>
            <strong>Mistake:</strong> Bidding without tracking who can still compete<br/>
            <strong>Consequence:</strong> Missing opportunities to secure players cheaply<br/>
            <strong>Solution:</strong> Mental note of who's low on funds, exploit their weakness
          </p>
        </div>

        <div style={{ 
          padding: '20px', 
          background: '#fff3cd', 
          borderLeft: '4px solid #ffc107', 
          borderRadius: '4px'
        }}>
          <h4 style={{ color: '#856404', marginBottom: '10px' }}>5. No Round 2 Buffer</h4>
          <p style={{ margin: 0, lineHeight: '1.8' }}>
            <strong>Mistake:</strong> Spending entire budget in Round 1<br/>
            <strong>Consequence:</strong> Limited options for team completion if slots remain<br/>
            <strong>Solution:</strong> Reserve 100-150 points for Round 2 flexibility
          </p>
        </div>
      </section>

      {/* Post-Auction Analysis */}
      <section style={{ marginBottom: '30px' }}>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          📊 Post-Auction Analysis
        </h3>
        
        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
          Team Strength Assessment Metrics:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li><strong>Average Points Per Player (APPP):</strong> Historical season average of your 11 starters</li>
          <li><strong>Budget Efficiency Ratio:</strong> Total historical points / Total cost spent</li>
          <li><strong>Role Coverage Score:</strong> 0-100 scale based on how well requirements are exceeded</li>
          <li><strong>Star Power Index:</strong> Number of players in top 20% of their role</li>
        </ul>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Comparative Analysis vs. Competitors:
        </h4>
        <p style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          Rank all 8 teams on: Total projected points, Budget efficiency, Batting strength, Bowling strength, All-rounder depth
        </p>

        <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
          Risk Exposure Evaluation:
        </h4>
        <ul style={{ paddingLeft: '40px', lineHeight: '1.8' }}>
          <li>How many players are injury-prone or in poor recent form?</li>
          <li>Is team too dependent on 1-2 star players?</li>
          <li>Do you have adequate bench coverage for each role?</li>
        </ul>
      </section>

      {/* Learning Objectives */}
      <section>
        <h3 style={{ color: '#02084b', fontSize: '20px', marginBottom: '15px' }}>
          🎓 Learning Objectives (Academic/Training Context)
        </h3>
        
        <div style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px' }}>
            Key Concepts Demonstrated:
          </h4>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Decision-Making Under Uncertainty:</strong> Player performance is uncertain, must assess probability and risk</li>
            <li><strong>Resource Allocation Optimization:</strong> Limited budget forces trade-off decisions and prioritization</li>
            <li><strong>Strategic Bidding Behavior:</strong> Game theory in action - anticipate competitor moves</li>
            <li><strong>Opportunity Cost Analysis:</strong> Every choice has alternatives - constant evaluation required</li>
            <li><strong>Sunk Cost Fallacy Awareness:</strong> Don't chase players just because you've already bid high</li>
            <li><strong>Real-Time Adaptive Strategy:</strong> Plans must change based on auction flow and competitor behavior</li>
            <li><strong>Constraint-Based Problem Solving:</strong> Work within hard limits (budget, team requirements)</li>
            <li><strong>Data-Driven Decision Making:</strong> Use historical performance data to inform valuations</li>
          </ul>

          <h4 style={{ color: '#02084b', fontSize: '18px', marginBottom: '10px', marginTop: '20px' }}>
            Simulation Debriefing Questions:
          </h4>
          <ul style={{ paddingLeft: '20px' }}>
            <li>What was your initial strategy? Did you stick to it? Why/why not?</li>
            <li>Which decision do you regret most? What would you change?</li>
            <li>How did competitor behavior influence your decisions?</li>
            <li>What surprised you most about the auction dynamics?</li>
            <li>If you could run the auction again, what would you do differently?</li>
          </ul>
        </div>
      </section>

      {/* Final Note */}
      <div style={{ 
        marginTop: '30px', 
        padding: '20px', 
        background: '#d1ecf1', 
        borderLeft: '4px solid #0c5460', 
        borderRadius: '4px' 
      }}>
        <p style={{ margin: 0, lineHeight: '1.8' }}>
          <strong>Remember:</strong> The auction simulation mirrors real business scenarios - limited resources, competitive dynamics, uncertainty, and time pressure. The skills developed here (analytical thinking, strategic planning, real-time decision-making, risk assessment) directly translate to business contexts like M&A negotiations, resource allocation in project management, and strategic planning exercises.
        </p>
      </div>
    </div>
  );
}