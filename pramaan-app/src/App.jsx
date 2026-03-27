import { WagmiProvider, http } from 'wagmi'
import { sepolia, baseSepolia } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig } from '@rainbow-me/rainbowkit'
import { AnonAadhaarProvider } from '@anon-aadhaar/react'
import '@rainbow-me/rainbowkit/styles.css'

import { BrowserRouter, Route, Routes } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";

import Index from "./pages/Index";
import Gateway from "./pages/Gateway";
import CreateIdentity from "./pages/CreateIdentity";
import VerifyIdentity from "./pages/VerifyIdentity";
import LenderDashboard from "./pages/LenderDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ApiDocs from "./pages/ApiDocs";
import NotFound from "./pages/NotFound";

// Reading straight from your perfect .env file
const config = getDefaultConfig({
  appName: 'Pramaan',
  projectId: "89c54866970235aa5f6d3e50442a4f8b",
  chains: [baseSepolia, sepolia],
  transports: {
    [sepolia.id]: http(),
    [baseSepolia.id]: http(),
  },
})

const queryClient = new QueryClient()
const useTestAadhaar = import.meta.env.VITE_USE_TEST_AADHAAR === 'true'

const App = () => (
  <ErrorBoundary>
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
                <Route path="/lender" element={<LenderDashboard />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/docs" element={<ApiDocs />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AnonAadhaarProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </ErrorBoundary>
);

export default App;
