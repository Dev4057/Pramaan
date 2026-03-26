import { motion } from "framer-motion";
import { ArrowRight, Shield, Users, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative px-6 py-32 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-glow-green/10 blur-[100px]"
          animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        className="relative max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      >
        <p className="text-sm text-primary font-bold uppercase tracking-[0.2em] mb-4">Get Started</p>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground text-balance">
          Ready to own your <span className="gradient-text">reputation?</span>
        </h2>
        <p className="mt-4 text-muted-foreground text-pretty max-w-lg mx-auto">
          Whether you're a gig worker building credit or a lender seeking verified data — Pramaan is your trust infrastructure.
        </p>

        {/* Dual CTA */}
        <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          <motion.button
            onClick={() => navigate("/gateway")}
            className="group glass-card-hover p-6 text-left"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground mb-1">I'm a Worker</p>
            <p className="text-xs text-muted-foreground mb-3">Build your verifiable on-chain credit identity</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
              Create Identity <ArrowRight className="w-3 h-3" />
            </span>
          </motion.button>

          <motion.button
            onClick={() => navigate("/lender")}
            className="group glass-card-hover p-6 text-left"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-10 h-10 rounded-xl bg-glow-yellow/15 flex items-center justify-center mb-3">
              <Building2 className="w-5 h-5 text-amber-600" />
            </div>
            <p className="font-semibold text-foreground mb-1">I'm a Lender</p>
            <p className="text-xs text-muted-foreground mb-3">Access verified credit reports via x402 API</p>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 group-hover:gap-2 transition-all">
              Lender Bureau <ArrowRight className="w-3 h-3" />
            </span>
          </motion.button>
        </div>

        {/* Trust badge */}
        <motion.div
          className="mt-12 inline-flex items-center gap-2 px-5 py-2.5 glass-surface text-muted-foreground text-xs font-medium"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
        >
          <Shield className="w-3.5 h-3.5 text-primary" />
          All data verified via zero-knowledge proofs — your privacy is non-negotiable
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CTASection;
