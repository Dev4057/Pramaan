import { WagmiProvider, http } from 'wagmi'
import { sepolia, baseSepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { AnonAadhaarProvider } from '@anon-aadhaar/react'
import '@rainbow-me/rainbowkit/styles.css'

import { BrowserRouter, Route, Routes } from "react-router-dom";

import Index from "./pages/Index";
import Gateway from "./pages/Gateway";
import CreateIdentity from "./pages/CreateIdentity";
import VerifyIdentity from "./pages/VerifyIdentity";

// Reading straight from your perfect .env file
const config = getDefaultConfig({
  appName: 'Pramaan',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: [sepolia, baseSepolia],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
})

const queryClient = new QueryClient()
const useTestAadhaar = import.meta.env.VITE_USE_TEST_AADHAAR === 'true'

const App = () => (
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider>
        <AnonAadhaarProvider _useTestAadhaar={useTestAadhaar}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/gateway" element={<Gateway />} />
              <Route path="/create" element={<CreateIdentity />} />
              <Route path="/verify" element={<VerifyIdentity />} />
            </Routes>
          </BrowserRouter>
        </AnonAadhaarProvider>
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>
);

export default App;