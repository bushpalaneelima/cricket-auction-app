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
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        Login
      </button>

      {/* Main Content - Centered */}
      <div style={{
        maxWidth: '1000px',
        textAlign: 'center',
      }}>
        {/* Title - Bright and visible */}
        <h1 style={{
          fontSize: '48px',
          marginBottom: '15px',
          fontWeight: 'bold',
          color: '#ffffff',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}>
          🎯 AuctionLab
        </h1>
        
        {/* Subtitle */}
        <p style={{
          fontSize: '18px',
          marginBottom: '8px',
          color: 'rgba(255,255,255,0.95)',
        }}>
          Professional auction engine for entertainment and education
        </p>

        <p style={{
          fontSize: '13px',
          marginBottom: '50px',
          color: 'rgba(255,255,255,0.6)',
        }}>
          by NB Blue Studios
        </p>

        {/* Two Use Cases - Side by Side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '30px',
          marginBottom: '50px',
        }}>
          {/* Entertainment Mode */}
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '30px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: '42px', marginBottom: '15px' }}>🎪</div>
            <h3 style={{ 
              fontSize: '22px', 
              marginBottom: '12px', 
              fontWeight: 'bold',
              color: '#ffffff',
            }}>
              Entertainment Mode
            </h3>
            <p style={{ 
              fontSize: '14px', 
              marginBottom: '15px',
              color: 'rgba(255,255,255,0.9)',
            }}>
              Live auction experience
            </p>
            <p style={{ 
              fontSize: '12px', 
              color: 'rgba(255,255,255,0.7)',
              lineHeight: '1.6',
            }}>
              Friend circles • Corporate teams • Fun & competition
            </p>
          </div>

          {/* Academic Mode */}
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            padding: '30px',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ fontSize: '42px', marginBottom: '15px' }}>🎓</div>
            <h3 style={{ 
              fontSize: '22px', 
              marginBottom: '12px', 
              fontWeight: 'bold',
              color: '#ffffff',
            }}>
              Academic Simulation
            </h3>
            <p style={{ 
              fontSize: '14px', 
              marginBottom: '15px',
              color: 'rgba(255,255,255,0.9)',
            }}>
              Strategy & budget allocation
            </p>
            <p style={{ 
              fontSize: '12px', 
              color: 'rgba(255,255,255,0.7)',
              lineHeight: '1.6',
            }}>
              MBA programs • Corporate L&D • Decision-making
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => router.push('/login')}
          style={{
            padding: '16px 60px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '40px',
            boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
            transition: 'transform 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Get Started →
        </button>

        {/* Footer */}
        <p style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.5)',
        }}>
          Powered by <strong style={{ color: 'rgba(255,255,255,0.7)' }}>NB Blue Studios</strong> • Professional Auction Engine
        </p>
      </div>
    </div>
  );
}