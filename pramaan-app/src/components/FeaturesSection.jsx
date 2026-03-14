import { motion } from "framer-motion";
import { Fingerprint, TrendingUp, Globe, Building2 } from "lucide-react";

const features = [
  {
    icon: Fingerprint,
    title: "Verifiable Identity",
    desc: "Proof-based identity verification rather than platform-controlled accounts.",
  },
  {
    icon: TrendingUp,
    title: "Gig Score",
    desc: "A credibility score derived from verified data — portable and trustworthy.",
  },
  {
    icon: Globe,
    title: "Portable Reputation",
    desc: "Workers carry their reputation across platforms without starting from zero.",
  },
  {
    icon: Building2,
    title: "Trust Infrastructure",
    desc: "A system built for real economic participation, not speculation.",
  },
];

const FeaturesSection = () => {
  return (
    <section className="relative px-6 py-24 overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/3 w-72 h-72 rounded-full bg-glow-yellow/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-glow-green/8 blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">Why Pramaan</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground text-balance">
            Built different. <span className="gradient-text">Built for trust.</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="glass-card-hover p-6 text-center group"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.2, 0, 0, 1] }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/12 transition-colors">
                <f.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="font-medium text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground text-pretty">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
