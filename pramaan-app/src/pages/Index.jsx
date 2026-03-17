import React from 'react';
import HeroSection from "../components/HeroSection";
import ProblemSection from "../components/ProblemSection";
import SolutionSection from "../components/SolutionSection";
import FeaturesSection from "../components/FeaturesSection";
import CTASection from "../components/CTASection";
import { ConnectButton } from '@rainbow-me/rainbowkit'; // Added Web3 Login!

const Index = () => {
  return (
    <div className="min-h-svh bg-background relative">
      {/* Global ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-glow-green/5 blur-[120px]" />
        <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] rounded-full bg-glow-yellow/5 blur-[120px]" />
        <div className="absolute -bottom-40 right-1/3 w-[450px] h-[450px] rounded-full bg-glow-green/4 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="glass-surface px-5 py-2.5 bg-[#FFF9C4]/90 dark:bg-[#FFF9C4]/20 backdrop-blur-xl rounded-xl border border-yellow-200/50">
            <span className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground drop-shadow-sm">Pramaan</span>
          </div>
          
          {/* Web3 Connect Button */}
        </div>
      </nav>
      
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <CTASection />
      
      <footer className="relative px-6 py-8 text-center text-xs text-muted-foreground">
        Pramaan Protocol · Verifiable Identity for the Gig Economy
      </footer>
    </div>
  );
};

export default Index;