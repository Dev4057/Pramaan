import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GigScorePreview from "./GigScorePreview";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-svh flex items-center justify-center px-6 py-24 overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-glow-green/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-glow-yellow/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-glow-green/5 blur-[100px] pointer-events-none" />

      <div className="relative max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 glass-surface text-primary text-sm font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Protocol Live
          </div>
        </motion.div>

        <motion.h1
          className="mt-8 text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-foreground text-balance leading-[1.08]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.2, 0, 0, 1] }}
        >
          Your work is
          <br />
          <span className="gradient-text">your credit.</span>
        </motion.h1>

        <motion.p
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          Pramaan creates a verifiable on-chain identity layer for gig workers.
          Prove your credibility anywhere in the ecosystem.
        </motion.p>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.2, 0, 0, 1] }}
        >
          <button
            onClick={() => navigate("/gateway")}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-medium text-base transition-all duration-200 ease-out hover:shadow-lg hover:shadow-primary/20 active:scale-95"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>

        <motion.div
          className="mt-20"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <GigScorePreview />
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
