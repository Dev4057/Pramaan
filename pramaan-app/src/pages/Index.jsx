import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import HeroSection from "../components/HeroSection";
import ProblemSection from "../components/ProblemSection";
import SolutionSection from "../components/SolutionSection";
import FeaturesSection from "../components/FeaturesSection";
import CTASection from "../components/CTASection";

const Index = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-svh bg-background relative">
      {/* Global ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-glow-green/5 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-glow-yellow/5 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-[450px] h-[450px] rounded-full bg-glow-green/4 blur-[120px]" />
      </div>

      {/* Professional Navbar */}
      <motion.nav
        className={`fixed top-0 left-0 right-0 z-50 px-6 py-3 transition-all duration-300 ${
          scrolled ? "backdrop-blur-2xl bg-background/80 border-b border-border/50 shadow-sm" : ""
        }`}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-[#FFF9C4]/90 dark:bg-[#FFF9C4]/20 backdrop-blur-xl rounded-xl border border-yellow-200/50">
              <span className="text-xl font-extrabold tracking-tight text-foreground">Pramaan</span>
            </div>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 bg-muted/50 px-2 py-1 rounded-md">
              RaaS Protocol
            </span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: "Workers", path: "/gateway" },
              { label: "Lenders", path: "/lender" },
              { label: "API Docs", path: "/docs" },
            ].map(link => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-foreground/[0.03]"
              >
                {link.label}
              </button>
            ))}
            <button
              onClick={() => navigate("/gateway")}
              className="ml-2 px-5 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl hover:shadow-md hover:shadow-primary/20 transition-all active:scale-95"
            >
              Launch App
            </button>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 rounded-xl hover:bg-foreground/5 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="md:hidden mt-3 glass-card p-4 space-y-1"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              {[
                { label: "Workers", path: "/gateway" },
                { label: "Lenders", path: "/lender" },
                { label: "API Docs", path: "/docs" },
              ].map(link => (
                <button
                  key={link.path}
                  onClick={() => { navigate(link.path); setMobileMenuOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm font-medium text-foreground rounded-xl hover:bg-foreground/5 transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <CTASection />

      {/* Footer */}
      <footer className="relative px-6 py-12 border-t border-border/50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold tracking-tight text-foreground">Pramaan</span>
            <span className="text-xs text-muted-foreground">Reputation-as-a-Service Protocol</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <button onClick={() => navigate("/docs")} className="hover:text-foreground transition-colors">API Docs</button>
            <button onClick={() => navigate("/gateway")} className="hover:text-foreground transition-colors">Launch App</button>
            <span>Base Sepolia</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
