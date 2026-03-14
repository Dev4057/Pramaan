import { motion } from "framer-motion";
import { AlertTriangle, Lock, Unlink, Ban } from "lucide-react";

const problems = [
  { icon: AlertTriangle, title: "No Verifiable Reputation", desc: "Gig workers lack a portable way to prove their work history and reliability." },
  { icon: Lock, title: "Centralized Scoring", desc: "Platforms control worker ratings — lock-in that erases years of credibility." },
  { icon: Unlink, title: "Fragmented Identity", desc: "Verification is siloed. Each platform starts from zero." },
  { icon: Ban, title: "No Cross-Platform Credibility", desc: "Workers cannot carry their reputation from one platform to another." },
];

const ProblemSection = () => {
  return (
    <section className="px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">The Problem</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground text-balance">
            Identity in the gig economy is broken
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-4">
          {problems.map((item, i) => (
            <motion.div
              key={item.title}
              className="glass-card p-6"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.2, 0, 0, 1] }}
            >
              <item.icon className="w-5 h-5 text-muted-foreground mb-3" strokeWidth={1.5} />
              <h3 className="font-medium text-foreground mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground text-pretty">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
