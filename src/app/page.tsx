'use client';

import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      color: 'white',
    }}>
      {/* Header */}
      <header style={{
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
          🏏 Cricket Auction Platform
        </h1>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '10px 30px',
            background: 'white',
            color: '#02084b',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Login
        </button>
      </header>

      {/* Hero Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '60px 40px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontSize: '48px',
          marginBottom: '20px',
          fontWeight: 'bold',
        }}>
          Structured Digital Auction Engine
        </h2>
        <p style={{
          fontSize: '20px',
          marginBottom: '40px',
          opacity: 0.9,
          maxWidth: '800px',
          margin: '0 auto 40px',
        }}>
          A professional auction platform that can be used either as a fun IPL-style experience 
          or as a strategic management simulation for learning and development.
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '15px 40px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
          }}
        >
          Get Started →
        </button>
      </section>

      {/* Two Use Cases */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '30px',
      }}>
        {/* Use Case A: Entertainment */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '30px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎪</div>
          <h3 style={{ fontSize: '24px', marginBottom: '15px', fontWeight: 'bold' }}>
            Entertainment Mode
          </h3>
          <p style={{ fontSize: '16px', marginBottom: '20px', opacity: 0.9 }}>
            Structured IPL-style auction experience
          </p>
          <ul style={{ 
            textAlign: 'left', 
            fontSize: '14px', 
            lineHeight: '1.8',
            opacity: 0.85,
            paddingLeft: '20px',
          }}>
            <li>Friend circles & corporate teams</li>
            <li>Housing communities & social groups</li>
            <li>2-round auction with budget constraints</li>
            <li>Real-time bidding & team building</li>
            <li>Fun, competition, and bonding</li>
          </ul>
          <p style={{
            marginTop: '20px',
            fontSize: '14px',
            opacity: 0.7,
            fontStyle: 'italic',
          }}>
            Revenue: Hosting fee per event
          </p>
        </div>

        {/* Use Case B: Academic */}
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          padding: '30px',
          borderRadius: '12px',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎓</div>
          <h3 style={{ fontSize: '24px', marginBottom: '15px', fontWeight: 'bold' }}>
            Academic Simulation Mode
          </h3>
          <p style={{ fontSize: '16px', marginBottom: '20px', opacity: 0.9 }}>
            Live strategy & budget allocation simulation
          </p>
          <ul style={{ 
            textAlign: 'left', 
            fontSize: '14px', 
            lineHeight: '1.8',
            opacity: 0.85,
            paddingLeft: '20px',
          }}>
            <li>MBA programs & business schools</li>
            <li>Corporate L&D workshops</li>
            <li>Decision-making under constraints</li>
            <li>Capital allocation strategies</li>
            <li>Behavioral bias learning</li>
          </ul>
          <p style={{
            marginTop: '20px',
            fontSize: '14px',
            opacity: 0.7,
            fontStyle: 'italic',
          }}>
            Revenue: Workshop/academic license
          </p>
        </div>
      </section>

      {/* Core Features */}
      <section style={{
        maxWidth: '1200px',
        margin: '40px auto',
        padding: '40px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px',
      }}>
        <h3 style={{ 
          fontSize: '32px', 
          marginBottom: '30px', 
          textAlign: 'center',
          fontWeight: 'bold',
        }}>
          Core Auction Engine Features
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
        }}>
          {[
            { icon: '⚙️', title: '2-Round System', desc: 'Strategic auction flow with Round 1 bidding and Round 2 selections' },
            { icon: '💰', title: 'Budget Logic', desc: 'Min 11, Max 15 players with points-based budget management' },
            { icon: '⏱️', title: 'Real-Time Control', desc: 'Admin controls, timer, pause, skip, and warning systems' },
            { icon: '📊', title: 'Team Building', desc: 'Role constraints, class bands, and squad composition rules' },
            { icon: '🔒', title: 'Secure & Stable', desc: 'Robust system with proper validation and error handling' },
            { icon: '📈', title: 'Analytics', desc: 'Detailed reports, history tracking, and performance metrics' },
          ].map((feature, i) => (
            <div key={i} style={{
              padding: '20px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>{feature.icon}</div>
              <h4 style={{ fontSize: '16px', marginBottom: '8px', fontWeight: 'bold' }}>
                {feature.title}
              </h4>
              <p style={{ fontSize: '13px', opacity: 0.8 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        maxWidth: '800px',
        margin: '60px auto',
        padding: '40px',
        textAlign: 'center',
      }}>
        <h3 style={{ fontSize: '36px', marginBottom: '20px', fontWeight: 'bold' }}>
          Ready to Experience It?
        </h3>
        <p style={{ fontSize: '18px', marginBottom: '30px', opacity: 0.9 }}>
          Whether you want to run a fun auction with friends or conduct a professional 
          business simulation, our platform adapts to your needs.
        </p>
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '15px 50px',
            background: 'white',
            color: '#02084b',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '18px',
            fontWeight: 'bold',
          }}
        >
          Login to Get Started
        </button>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '30px',
        textAlign: 'center',
        opacity: 0.7,
      }}>
        <p>Powered by <strong>NB Blue Studios</strong></p>
        <p style={{ fontSize: '12px', marginTop: '10px' }}>
          Professional Auction Engine • Entertainment & Education
        </p>
      </footer>
    </div>
  );
}