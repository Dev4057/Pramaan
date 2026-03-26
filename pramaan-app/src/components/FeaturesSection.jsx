import { motion } from "framer-motion";
import { Fingerprint, TrendingUp, Globe, Building2, Shield, Cpu, Layers, CreditCard } from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Anon Aadhaar ZK",
    desc: "Government-issued identity verified using zero-knowledge proofs. No PII exposure.",
    gradient: "from-emerald-500/10 to-teal-500/10",
  },
  {
    icon: TrendingUp,
    title: "Composite Scoring",
    desc: "Actuarial-grade weighted scoring across developer, financial, gig, and social signals.",
    gradient: "from-yellow-500/10 to-amber-500/10",
  },
  {
    icon: Globe,
    title: "Multi-Provider RaaS",
    desc: "GitHub, Uber, SBI, LinkedIn — add any data source via the Reclaim ZK protocol.",
    gradient: "from-blue-500/10 to-indigo-500/10",
  },
  {
    icon: Building2,
    title: "x402 Monetization",
    desc: "Lenders pay per credit report query via the x402 HTTP payment protocol. Workers own their data.",
    gradient: "from-purple-500/10 to-pink-500/10",
  },
  {
    icon: Shield,
    title: "On-Chain Verified",
    desc: "Scores are minted as verifiable on-chain records on Base L2 — immutable and transparent.",
    gradient: "from-emerald-500/10 to-green-500/10",
  },
  {
    icon: Cpu,
    title: "AI Risk Analysis",
    desc: "Optional AI-powered credit risk reports via integrated LLM agent for deeper lender insights.",
    gradient: "from-cyan-500/10 to-sky-500/10",
  },
  {
    icon: Layers,
    title: "Tiered Reputation",
    desc: "5-tier system from Early-Stage to Exceptional — reflects real-world creditworthiness progression.",
    gradient: "from-orange-500/10 to-red-500/10",
  },
  {
    icon: CreditCard,
    title: "Lender Bureau",
    desc: "Enterprise dashboard for lenders to query verified worker credit data with one API call.",
    gradient: "from-violet-500/10 to-fuchsia-500/10",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative px-6 py-28 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Ambient glow */}
      <motion.div
        className="absolute top-0 left-1/3 w-72 h-72 rounded-full bg-glow-yellow/8 blur-3xl pointer-events-none"
        animate={{ x: [0, 30, 0], opacity: [0.06, 0.1, 0.06] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-primary font-bold uppercase tracking-[0.2em] mb-3">Platform Capabilities</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground text-balance">
            Built different. <span className="gradient-text">Built for trust.</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass-card-hover p-6 group relative overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.2, 0, 0, 1] }}
            >
              {/* Gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl`} />

              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tech stack ribbon */}
        <motion.div
          className="mt-16 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mr-2">Built With</span>
          {["React", "Base L2", "Reclaim Protocol", "Anon Aadhaar", "Viem", "Prisma", "Express", "ZK-SNARKs"].map(tech => (
            <span
              key={tech}
              className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-foreground/[0.03] text-muted-foreground/60 border border-border/50"
            >
              {tech}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
