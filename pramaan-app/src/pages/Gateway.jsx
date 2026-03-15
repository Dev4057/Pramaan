import { motion } from "framer-motion";
import { UserPlus, ShieldCheck, ArrowRight, Wallet, DatabaseZap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

const Gateway = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  return (
    <div className="relative min-h-svh flex items-center justify-center px-6 py-24 overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-glow-green/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 -right-20 w-72 h-72 rounded-full bg-glow-yellow/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-3xl w-full">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
        >
          <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">Identity Gateway</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground text-balance">
            What would you like to do?
          </h1>
        </motion.div>

        {/* Custom Glass Wallet Connect */}
        <motion.div 
          className="flex justify-center mb-12"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        >
          <ConnectButton.Custom>
            {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
              const ready = mounted;
              const connected = ready && account && chain;

              return (
                <div {...(!ready && { 'aria-hidden': true, style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' } })}>
                  {!connected ? (
                    <button onClick={openConnectModal} className="glass-card px-6 py-3 flex items-center gap-2 font-medium hover:bg-white/40 transition-all text-foreground">
                      <Wallet className="w-4 h-4 text-primary" /> Connect Wallet to Continue
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={openChainModal} className="glass-card px-4 py-2 flex items-center gap-2 text-sm font-medium hover:bg-white/40 transition-all">
                        {chain.name}
                      </button>
                      <button onClick={openAccountModal} className="glass-card px-4 py-2 flex items-center gap-2 text-sm font-medium hover:bg-white/40 transition-all">
                        {account.displayName}
                      </button>
                    </div>
                  )}
                </div>
              );
            }}
          </ConnectButton.Custom>
        </motion.div>

        <div className={`grid sm:grid-cols-3 gap-4 ${!isConnected ? 'opacity-50 pointer-events-none grayscale-[50%]' : ''} transition-all duration-500`}>
          {[
            {
              icon: UserPlus,
              title: "Create Identity",
              desc: "New to Pramaan? Create your verifiable identity and generate your Gig Score.",
              route: "/create",
              glowClass: "hover:border-glow-green/30",
            },
            {
              icon: ShieldCheck,
              title: "Verify Identity",
              desc: "Already have a Pramaan identity? View and verify your credentials.",
              route: "/verify",
              glowClass: "hover:border-glow-yellow/30",
            },
            {
              icon: DatabaseZap,
              title: "Lender Dashboard",
              desc: "Access the x402 Protocol to fetch deep analytics and worker profiles.",
              route: "/lender",
              glowClass: "hover:border-primary/40",
            },
          ].map((card, i) => (
            <motion.button
              key={card.title}
              onClick={() => navigate(card.route)}
              className={`glass-card-hover p-8 text-left flex flex-col justify-between min-h-[320px] group cursor-pointer ${card.glowClass}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.05, ease: [0.2, 0, 0, 1] }}
              whileHover={{ y: -4 }}
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/8 flex items-center justify-center mb-6 group-hover:bg-primary/12 transition-colors">
                  <card.icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-semibold text-foreground mb-2">{card.title}</h2>
                <p className="text-sm text-muted-foreground text-pretty">{card.desc}</p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-primary text-sm font-medium group-hover:gap-3 transition-all duration-200">
                Continue
                <ArrowRight className="w-4 h-4" />
              </div>
            </motion.button>
          ))}
        </div>

        <motion.button
          onClick={() => navigate("/")}
          className="mt-8 block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          ← Back to Home
        </motion.button>
      </div>
    </div>
  );
};

export default Gateway;