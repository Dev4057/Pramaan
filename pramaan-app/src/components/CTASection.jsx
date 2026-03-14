import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative px-6 py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-glow-green/8 blur-[80px]" />
      </div>
      <motion.div
        className="relative max-w-2xl mx-auto text-center"
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      >
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground text-balance">
          Ready to build your verifiable identity?
        </h2>
        <p className="mt-4 text-muted-foreground text-pretty">
          Join the protocol and make your work history portable, provable, and permanent.
        </p>
        <button
          onClick={() => navigate("/gateway")}
          className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-medium text-base transition-all duration-200 ease-out hover:shadow-lg hover:shadow-primary/20 active:scale-95"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </section>
  );
};

export default CTASection;
