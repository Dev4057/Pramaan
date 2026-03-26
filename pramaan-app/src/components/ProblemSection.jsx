import { motion } from "framer-motion";
import { AlertTriangle, Lock, Unlink, Ban } from "lucide-react";

const problems = [
  {
    icon: AlertTriangle,
    title: "No Verifiable Reputation",
    desc: "300M+ gig workers globally have no portable proof of their work history. Every new platform starts from zero.",
    stat: "300M+",
    statLabel: "unbanked gig workers"
  },
  {
    icon: Lock,
    title: "Centralized Scoring",
    desc: "Platforms own your rating. Leave Uber? Your 4.9-star, 5000-ride reputation disappears overnight.",
    stat: "100%",
    statLabel: "platform lock-in"
  },
  {
    icon: Unlink,
    title: "Fragmented Identity",
    desc: "Your GitHub contributions, bank statements, and driver rating exist in silos. No system connects them.",
    stat: "0",
    statLabel: "cross-platform portability"
  },
  {
    icon: Ban,
    title: "Credit Invisibility",
    desc: "Traditional credit scores don't capture gig economy income. Workers are denied loans despite proven earning history.",
    stat: "65%",
    statLabel: "loan rejection rate"
  },
];

const ProblemSection = () => {
  return (
    <section className="px-6 py-28 relative">
      {/* Subtle divider gradient */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-destructive/80 font-bold uppercase tracking-[0.2em] mb-3">The Problem</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground text-balance">
            Identity in the gig economy is <span className="text-destructive/70">broken</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-pretty">
            Workers build years of reputation on centralized platforms — but own none of it.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5">
          {problems.map((item, i) => (
            <motion.div
              key={item.title}
              className="glass-card p-7 group relative overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.2, 0, 0, 1] }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
            >
              {/* Background stat watermark */}
              <div className="absolute -right-2 -bottom-2 text-7xl font-black text-foreground/[0.03] font-mono-data select-none">
                {item.stat}
              </div>

              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-destructive/5 flex items-center justify-center mb-4 group-hover:bg-destructive/10 transition-colors">
                  <item.icon className="w-5 h-5 text-destructive/60" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-lg">{item.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty leading-relaxed">{item.desc}</p>
                <div className="mt-4 pt-3 border-t border-border/40">
                  <p className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">
                    {item.stat} <span className="font-normal">{item.statLabel}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
