import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

export default function ActionSelection({ setView }) {
  const { isConnected } = useAccount();

  return (
    <div style={{ maxWidth: '800px', margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <p style={{ color: '#166534', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '13px', marginBottom: '12px' }}>Identity Gateway</p>
      <h2 style={{ fontSize: '36px', color: 'var(--text-heading)', marginBottom: '40px', letterSpacing: '-0.02em' }}>What would you like to do?</h2>

      {!isConnected ? (
        <div className="glass-panel" style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>Please connect your wallet to continue.</p>
          <ConnectButton />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
          
          <div className="glass-panel" onClick={() => setView('worker')} style={{ padding: '32px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(22, 101, 52, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '24px' }}>👤</div>
            <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>Create Identity</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', margin: 0, flexGrow: 1 }}>New to Pramaan? Create your verifiable identity and generate your Gig Score.</p>
            <div style={{ marginTop: '24px', color: '#166534', fontWeight: '600', fontSize: '14px' }}>Continue →</div>
          </div>

          <div className="glass-panel" onClick={() => setView('lender')} style={{ padding: '32px', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(22, 101, 52, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', marginBottom: '24px' }}>🛡️</div>
            <h3 style={{ fontSize: '20px', margin: '0 0 8px 0' }}>Verify Identity</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5', margin: 0, flexGrow: 1 }}>Already have a Pramaan identity? View and verify credentials via Smart Contract.</p>
            <div style={{ marginTop: '24px', color: '#166534', fontWeight: '600', fontSize: '14px' }}>Continue →</div>
          </div>

        </div>
      )}
    </div>
  );
}