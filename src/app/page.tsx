'use client';

import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #02084b 0%, #3E5B99 100%)',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20px',
      position: 'relative',
    }}>
      {/* Login Button - Top Right */}
      <button
        onClick={() => router.push('/login')}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
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

      {/* Main Content - Centered */}
      <div style={{
        maxWidth: '1000px',
        textAlign: 'center',
      }}>
        {/* Title */}
        <h1 style={{
          fontSize: '42px',
          marginBottom: '15px',
          fontWeight: 'bold',
        }}>
          🏏 Cricket Auction Platform
        </h1>
        
        {/* Subtitle */}
        <p style={{
          fontSize: '18px',
          marginBottom: '40px',
          opacity: 0.9,
        }}>
          Professional auction engine for entertainment and education
        </p>

        {/* Two Use Cases - Side by Side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '25px',
          marginBottom: '40px',
        }}>
          {/* Entertainment Mode */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '25px',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎪</div>
            <h3 style={{ fontSize: '20px', marginBottom: '10px', fontWeight: 'bold' }}>
              Entertainment Mode
            </h3>
            <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '12px' }}>
              IPL-style auction experience
            </p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>
              Friend circles • Corporate teams • Fun & competition
            </p>
          </div>

          {/* Academic Mode */}
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '25px',
            borderRadius: '10px',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🎓</div>
            <h3 style={{ fontSize: '20px', marginBottom: '10px', fontWeight: 'bold' }}>
              Academic Simulation
            </h3>
            <p style={{ fontSize: '13px', opacity: 0.85, marginBottom: '12px' }}>
              Strategy & budget allocation
            </p>
            <p style={{ fontSize: '12px', opacity: 0.7 }}>
              MBA programs • Corporate L&D • Decision-making
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '15px 50px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '30px',
          }}
        >
          Get Started →
        </button>

        {/* Footer */}
        <p style={{
          fontSize: '12px',
          opacity: 0.6,
        }}>
          Powered by <strong>NB Blue Studios</strong> • Professional Auction Engine
        </p>
      </div>
    </div>
  );
}