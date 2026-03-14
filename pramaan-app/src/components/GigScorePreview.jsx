import { Shield } from "lucide-react";

const GigScorePreview = () => {
  return (
    <div className="glass-accent p-8 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="text-left">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pramaan Identity</p>
          <p className="text-sm text-foreground mt-1 font-medium">Ananya Sharma</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 backdrop-blur-sm text-success text-xs font-medium border border-success/15">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Verified
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Gig Score</p>
          <p className="text-5xl font-semibold font-mono-data tracking-tight gradient-text">782</p>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span className="text-xs">On-chain verified</span>
        </div>
      </div>
    </div>
  );
};

export default GigScorePreview;
