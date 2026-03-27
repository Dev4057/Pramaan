import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Shield, Zap, Globe2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

// Animated counter component
const AnimatedNumber = ({ target, duration = 2 }) => {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true;
        const start = performance.now();
        const step = (now) => {
          const progress = Math.min((now - start) / (duration * 1000), 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.floor(eased * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{value}</span>;
};

// Floating particle dots
const FloatingDots = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 rounded-full bg-primary/30"
        style={{
          left: `${15 + i * 15}%`,
          top: `${20 + (i % 3) * 25}%`,
        }}
        animate={{
          y: [0, -20, 0],
          opacity: [0.2, 0.6, 0.2],
        }}
        transition={{
          duration: 3 + i * 0.5,
          repeat: Infinity,
          delay: i * 0.4,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

// Live protocol pulse ring
const PulseRing = () => (
  <span className="relative flex h-2.5 w-2.5">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
  </span>
);

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-svh flex items-center justify-center px-6 py-24 overflow-hidden">
      <FloatingDots />

      {/* Ambient glow blobs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-glow-green/10 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.15, 1], opacity: [0.1, 0.18, 0.1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-glow-yellow/10 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-glow-green/5 blur-[100px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Protocol badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        >
          <div className="inline-flex items-center gap-2.5 px-5 py-2 glass-surface text-primary text-sm font-semibold tracking-wide">
            <PulseRing />
            Reputation-as-a-Service Protocol
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          className="mt-8 text-5xl sm:text-6xl lg:text-[5.5rem] font-semibold tracking-tight text-foreground leading-[1.05]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.2, 0, 0, 1] }}
        >
          Your work is
          <br />
          <span className="gradient-text">your credit score.</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          Pramaan is a decentralized RaaS platform that aggregates verified reputation
          from multiple sources into a single, portable, on-chain credit identity —
          powered by ZK proofs.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.2, 0, 0, 1] }}
        >
          <button
            onClick={() => navigate("/gateway")}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base transition-all duration-200 ease-out hover:shadow-lg hover:shadow-primary/25 active:scale-95"
          >
            Launch App
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
          <button
            onClick={() => navigate("/docs")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl glass-surface font-semibold text-foreground text-base transition-all duration-200 hover:bg-primary/5"
          >
            API Documentation
          </button>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="mt-20 grid grid-cols-3 gap-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          {[
            { value: 4, suffix: "+", label: "Verification Sources", icon: Globe2 },
            { value: 100, suffix: "%", label: "ZK-Verified Proofs", icon: Shield },
            { value: 3, suffix: "s", label: "Avg Score Generation", icon: Zap },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              className="glass-card p-5 text-center"
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <stat.icon className="w-4 h-4 text-primary mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-3xl font-semibold font-mono-data tracking-tight text-foreground">
                <AnimatedNumber target={stat.value} duration={1.5 + i * 0.3} />{stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Animated score card preview */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, delay: 0.7, ease: [0.2, 0, 0, 1] }}
        >
          <ScoreCardPreview />
        </motion.div>
      </div>
    </section>
  );
};

// Enhanced interactive score card
const ScoreCardPreview = () => {
  const [hovered, setHovered] = useState(false);

  const providers = [
    { name: "GitHub", score: 80, color: "hsl(152, 60%, 40%)", weight: "35%" },
    { name: "Uber", score: 65, color: "hsl(48, 90%, 50%)", weight: "25%" },
    { name: "SBI Bank", score: 75, color: "hsl(200, 60%, 50%)", weight: "25%" },
    { name: "LinkedIn", score: 70, color: "hsl(210, 70%, 45%)", weight: "15%" },
  ];

  return (
    <div
      className="glass-accent p-8 max-w-md mx-auto relative overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Scanning line on hover */}
      {hovered && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
            initial={{ top: 0 }}
            animate={{ top: "100%" }}
            transition={{ duration: 1.5, ease: "linear" }}
          />
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-left">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">Pramaan Identity</p>
          <p className="text-sm text-foreground mt-1 font-semibold">Ananya Sharma</p>
          <p className="text-[10px] text-muted-foreground font-mono-data mt-0.5">0x1588...9AE6</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-bold border border-success/15">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          On-Chain
        </div>
      </div>

      {/* Score */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Composite RaaS Score</p>
          <p className="text-6xl font-semibold font-mono-data tracking-tighter gradient-text">
            <AnimatedNumber target={78} duration={2} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Strong</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">4 sources verified</p>
        </div>
      </div>

      {/* Provider breakdown bars */}
      <div className="space-y-2.5 pt-4 border-t border-border/40">
        {providers.map((p, i) => (
          <motion.div
            key={p.name}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 + i * 0.1, duration: 0.4 }}
          >
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="font-semibold text-foreground/80">{p.name} <span className="text-muted-foreground font-normal">({p.weight})</span></span>
              <span className="font-mono-data text-muted-foreground">{p.score}/100</span>
            </div>
            <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: p.color }}
                initial={{ width: 0 }}
                whileInView={{ width: `${p.score}%` }}
                viewport={{ once: true }}
                transition={{ delay: 1 + i * 0.15, duration: 0.8, ease: [0.2, 0, 0, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Footer badges */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/40">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
          <Shield className="w-3 h-3" />
          ZK-Verified
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
          Base Sepolia
        </div>
        <div className="text-[10px] text-muted-foreground font-mono-data">
          Minted 2026
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
