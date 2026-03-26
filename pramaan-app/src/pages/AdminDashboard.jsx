import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, Shield, Activity, RefreshCw, ArrowLeft,
  Github, Car, Landmark, Linkedin, Code, TrendingUp, Clock, Zap
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

const TIER_COLORS = {
  'Exceptional': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  'Strong': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'Moderate': 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  'Developing': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Early-Stage': 'text-gray-400 bg-gray-500/10 border-gray-500/30',
};

const ICON_MAP = { github: Github, car: Car, landmark: Landmark, linkedin: Linkedin };

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/stats`);
      const data = await res.json();
      if (data.ok) {
        setStats(data);
        setLastRefresh(new Date());
      }
    } catch (err) {
      console.error('[ADMIN] Failed to fetch stats:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = new Date(typeof ts === 'number' ? ts : ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="min-h-svh bg-background relative">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-glow-green/5 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-glow-yellow/5 blur-[120px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/gateway')} className="p-2 rounded-lg hover:bg-muted/50 transition">
              <ArrowLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Pramaan Protocol Analytics</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-muted-foreground">
                Updated {formatTime(lastRefresh)}
              </span>
            )}
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {loading && !stats ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <div className="space-y-6">

            {/* Overview Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Wallets', value: stats.overview.totalWallets, icon: Users, color: 'text-blue-500 bg-blue-500/10' },
                { label: 'Identity Verified', value: stats.overview.identityVerified, icon: Shield, color: 'text-emerald-500 bg-emerald-500/10' },
                { label: 'Scores Minted', value: stats.overview.scoresGenerated, icon: Zap, color: 'text-amber-500 bg-amber-500/10' },
                { label: 'Avg Score', value: stats.overview.averageScore, icon: TrendingUp, color: 'text-violet-500 bg-violet-500/10' },
              ].map((card, i) => (
                <motion.div
                  key={card.label}
                  className="p-4 rounded-xl border border-border bg-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${card.color}`}>
                      <card.icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs text-muted-foreground">{card.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">{card.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Provider Performance + Tier Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Provider Performance */}
              <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-card">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" /> Provider Performance
                </h2>
                <div className="space-y-3">
                  {Object.entries(stats.providerStats).map(([key, provider]) => {
                    const IconComp = ICON_MAP[provider.icon] || Code;
                    const maxVerified = Math.max(...Object.values(stats.providerStats).map(p => p.verified), 1);
                    const barWidth = (provider.verified / maxVerified) * 100;

                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="flex items-center gap-2 w-24 shrink-0">
                          <IconComp className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground truncate">{provider.name}</span>
                        </div>
                        <div className="flex-1 h-8 bg-muted/30 rounded-lg overflow-hidden relative">
                          <motion.div
                            className="h-full rounded-lg bg-primary/20"
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                          />
                          <div className="absolute inset-0 flex items-center px-3 justify-between">
                            <span className="text-xs text-muted-foreground">
                              {provider.verified} verified
                            </span>
                            <span className="text-xs font-medium text-foreground">
                              avg: {provider.avgScore}/100
                            </span>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-md border ${
                          provider.category === 'developer' ? 'text-violet-400 bg-violet-500/10 border-violet-500/20' :
                          provider.category === 'gig' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                          provider.category === 'financial' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                          'text-blue-400 bg-blue-500/10 border-blue-500/20'
                        }`}>
                          {provider.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tier Distribution */}
              <div className="p-6 rounded-xl border border-border bg-card">
                <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Tier Distribution
                </h2>
                {Object.keys(stats.tierDistribution).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(stats.tierDistribution).map(([tier, count]) => {
                      const total = Object.values(stats.tierDistribution).reduce((a, b) => a + b, 0);
                      const pct = Math.round((count / total) * 100);
                      const colors = TIER_COLORS[tier] || TIER_COLORS['Early-Stage'];
                      return (
                        <div key={tier}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${colors}`}>{tier}</span>
                            <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-primary/40"
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6 }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No scores minted yet</p>
                )}

                {/* System Info */}
                <div className="mt-6 pt-4 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="w-3 h-3" /> Uptime</span>
                    <span className="text-xs font-mono text-foreground">{formatUptime(stats.uptime)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Zap className="w-3 h-3" /> Providers</span>
                    <span className="text-xs font-mono text-foreground">{stats.overview.activeProviders} active</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="p-6 rounded-xl border border-border bg-card">
              <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Recent Activity
              </h2>
              {stats.recentActivity.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {stats.recentActivity.map((event, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        event.type === 'score_minted' ? 'bg-emerald-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-foreground font-mono">{event.wallet}</span>
                        {event.type === 'score_minted' ? (
                          <span className="text-sm text-muted-foreground">
                            {' '}— Score <span className="font-semibold text-foreground">{event.score}</span>
                            {' '}({event.tier}, {event.sources} source{event.sources !== 1 ? 's' : ''})
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground"> — Identity verified</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{formatTime(event.timestamp)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet</p>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">Failed to load stats. Is the backend running?</div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
