import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Home, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("[404] Route not found:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-svh flex items-center justify-center bg-background px-6 relative overflow-hidden">
      <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-glow-green/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/3 -right-20 w-72 h-72 rounded-full bg-glow-yellow/5 blur-[120px] pointer-events-none" />

      <motion.div
        className="max-w-md w-full text-center"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50 mb-6">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-6xl font-bold text-foreground mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-1">Page not found</p>
        <p className="text-sm text-muted-foreground/60 mb-8">
          <span className="font-mono bg-muted/50 px-2 py-0.5 rounded">{location.pathname}</span> doesn't exist
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted/50 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <a
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:brightness-95 transition"
          >
            <Home className="w-4 h-4" /> Home
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;
