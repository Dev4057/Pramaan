import { motion } from "framer-motion";
import { ShieldCheck, BarChart3, ArrowRightLeft, CheckCircle2, Fingerprint, Lock, Eye, EyeOff } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Fingerprint,
    label: "ZK Identity Verification",
    desc: "Verify your Aadhaar identity using Anon Aadhaar — zero-knowledge proofs ensure your personal data never leaves your device.",
    tags: ["Anon Aadhaar", "ZK-SNARK", "Privacy-First"],
    color: "primary",
  },
  {
    step: "02",
    icon: BarChart3,
    label: "Multi-Source Reputation",
    desc: "Connect GitHub, Uber, SBI Bank, LinkedIn, and more. Reclaim Protocol ZK-proofs verify your data without sharing credentials.",
    tags: ["Reclaim Protocol", "TLS Proxy", "4+ Providers"],
    color: "primary",
  },
  {
    step: "03",
    icon: ArrowRightLeft,
    label: "Composite Score Engine",
    desc: "Our actuarial scoring engine calculates a weighted composite score across all verified sources — your portable credit identity.",
    tags: ["Weighted Scoring", "Multi-Factor", "Actuarial"],
    color: "primary",
  },
  {
    step: "04",
    icon: CheckCircle2,
    label: "On-Chain Mint & Access",
    desc: "Score is minted on Base L2. Lenders pay via x402 protocol to access verified credit reports — workers earn from their own data.",
    tags: ["Base Sepolia", "x402 Protocol", "Data Ownership"],
    color: "primary",
  },
];

const SolutionSection = () => {
  return (
    <section className="px-6 py-28 relative overflow-hidden">
      {/* Ambient */}
      <motion.div
        className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-glow-green/6 blur-[100px] pointer-events-none"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-primary font-bold uppercase tracking-[0.2em] mb-3">How It Works</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground text-balance">
            From fragmented data to <span className="gradient-text">verifiable trust</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto text-pretty">
            Four steps to transform scattered platform reputations into a single, cryptographically-verified on-chain credit identity.
          </p>
        </motion.div>

        {/* Flow steps */}
        <div className="mt-16 relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute left-8 top-12 bottom-12 w-px bg-gradient-to-b from-primary/20 via-primary/10 to-transparent" />

          <div className="space-y-6">
            {steps.map((item, i) => (
              <motion.div
                key={item.label}
                className="glass-card p-7 relative group"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.2, 0, 0, 1] }}
                whileHover={{ x: 4, transition: { duration: 0.2 } }}
              >
                <div className="flex items-start gap-6">
                  {/* Step number + icon */}
                  <div className="flex-shrink-0 relative">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <item.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                    </div>
                    <span className="absolute -top-2 -left-2 text-[10px] font-mono-data font-bold text-primary/50 bg-background px-1.5 py-0.5 rounded-md border border-border/50">
                      {item.step}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg mb-1.5">{item.label}</h3>
                    <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{item.desc}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.tags.map(tag => (
                        <span key={tag} className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-primary/5 text-primary/70 border border-primary/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Privacy callout */}
        <motion.div
          className="mt-12 glass-accent p-6 flex items-center gap-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <EyeOff className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Zero-Knowledge by Default</p>
            <p className="text-xs text-muted-foreground mt-0.5">All proofs are generated client-side. Your raw data — Aadhaar number, bank balance, credentials — never leaves your device or touches our servers.</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SolutionSection;
