import { motion } from "framer-motion";
import { ShieldCheck, BarChart3, ArrowRightLeft, CheckCircle2 } from "lucide-react";

const SolutionSection = () => {
  return (
    <section className="px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">The Solution</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground text-balance">
            A trust layer built for real work
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-pretty">
            Pramaan creates a verifiable on-chain identity that includes verified Aadhaar identity, income validation, reputation signals, and a generated Gig Score.
          </p>
        </motion.div>

        <div className="mt-14 flex flex-col gap-3">
          {[
            { icon: ShieldCheck, label: "Verified Aadhaar Identity", desc: "Government-issued identity linked securely on-chain." },
            { icon: BarChart3, label: "Income Validation", desc: "Verified income data from bank statements and UPI transactions." },
            { icon: ArrowRightLeft, label: "Reputation Signals", desc: "Cross-platform work history aggregated into one profile." },
            { icon: CheckCircle2, label: "Generated Gig Score", desc: "A composite credibility score derived from verified data." },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              className="flex items-start gap-4 glass-card p-5"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: [0.2, 0, 0, 1] }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-medium text-foreground">{item.label}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
