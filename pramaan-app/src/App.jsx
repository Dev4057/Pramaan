import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import WorkerDashboard from './components/WorkerDashboard'
import LenderVerify from './components/LenderVerify'
import './App.css'

export default function App() {
  const { isConnected } = useAccount()
  const [view, setView] = useState('worker')

  const theme = {
    pageBg: '#f6f2ea',
    panel: '#fffdf9',
    border: '#ddd3c1',
    text: '#2f2a22',
    muted: '#7a7267',
    accent: '#a14b2a',
    accentSoft: '#f4e4d9'
  }

  const navButtonStyle = (active) => ({
    background: active ? theme.accentSoft : '#fffdf9',
    color: active ? theme.accent : theme.muted,
    border: `1px solid ${active ? '#d8b39f' : theme.border}`,
    padding: '8px 16px',
    borderRadius: '999px',
    cursor: 'pointer',
    fontWeight: 600
  })

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.pageBg, color: theme.text, fontFamily: 'Manrope, Segoe UI, sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', padding: '18px clamp(14px, 4vw, 40px)', borderBottom: `1px solid ${theme.border}`, background: 'rgba(255,253,249,0.9)', backdropFilter: 'blur(6px)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: theme.text, letterSpacing: '-0.02em' }}>Pramaan</h1>
          <p style={{ margin: 0, fontSize: '12px', color: theme.muted }}>Decentralised Income Verification</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setView('worker')}
            style={navButtonStyle(view === 'worker')}
          >
            Worker
          </button>
          <button
            onClick={() => setView('lender')}
            style={navButtonStyle(view === 'lender')}
          >
            Lender
          </button>
          <ConnectButton />
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: 'clamp(16px, 4vw, 36px) clamp(12px, 4vw, 40px)' }}>
        {!isConnected ? (
          <div style={{ textAlign: 'center', marginTop: 'clamp(24px, 8vw, 80px)', background: theme.panel, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: 'clamp(28px, 7vw, 56px) 20px' }}>
            <h2 style={{ fontSize: '38px', marginBottom: '14px', color: theme.text }}>Your income. Your proof. Your identity.</h2>
            <p style={{ color: theme.muted, fontSize: '18px', marginBottom: '34px' }}>Connect your wallet to get started</p>
            <ConnectButton />
          </div>
        ) : (
          view === 'worker' ? <WorkerDashboard /> : <LenderVerify />
        )}
      </div>

    </div>
  )
}