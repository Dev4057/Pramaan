import React from 'react';

export default function LandingPage({ onNext }) {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '80px 20px', textAlign: 'center' }}>
      
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '999px', background: 'rgba(22, 101, 52, 0.1)', color: '#166534', fontSize: '14px', fontWeight: '600', marginBottom: '32px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#166534', animation: 'pulse 2s infinite' }} />
        Protocol Live
      </div>

      <h1 style={{ fontSize: 'clamp(40px, 8vw, 72px)', lineHeight: '1.1', marginBottom: '24px', color: 'var(--text-heading)', fontWeight: '700', letterSpacing: '-0.03em' }}>
        Your work is <br/>
        <span className="gradient-text">your credit.</span>
      </h1>
      
      <p style={{ fontSize: '20px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 40px', lineHeight: '1.6' }}>
        Pramaan creates a verifiable on-chain identity layer for gig workers. Prove your credibility anywhere in the ecosystem.
      </p>
      
      <button 
        onClick={onNext}
        style={{
          padding: '16px 40px',
          fontSize: '18px',
          fontWeight: '600',
          color: '#fff',
          background: 'var(--text-heading)',
          border: 'none',
          cursor: 'pointer',
          borderRadius: '16px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Get Started →
      </button>
    </div>
  );
}