// backend/src/config/providers.js
// ═══════════════════════════════════════════════════════════════════
// PRAMAAN RaaS — Provider Registry
// Each provider defines: Reclaim provider ID, category, weight,
// display metadata, and how to extract the key metric from the proof.
// ═══════════════════════════════════════════════════════════════════

const PROVIDER_REGISTRY = {
  github: {
    id: '8573efb4-4529-47d3-80da-eaa7384dac19',
    name: 'GitHub Contributions',
    shortName: 'GitHub',
    category: 'developer',       // developer | gig | financial | social
    icon: 'github',
    description: 'Yearly contribution count from your GitHub profile',
    weight: 0.35,                // weight in composite score
    maxRawScore: 100,
    // How to extract the key metric from Reclaim proof parameters
    extractMetric(params) {
      const raw =
        params.contributions || params.totalContributions ||
        params.total_contributions || params.commits ||
        params.yearlyContributions || params.yearly_contributions ||
        params.contributionCount || params.contribution_count ||
        params.githubContributions;
      if (raw) return parseInt(String(raw).replace(/,/g, '').trim(), 10) || 0;
      // Numeric fallback
      const nums = Object.values(params).filter(v => {
        const n = parseInt(String(v).replace(/,/g, ''), 10);
        return !isNaN(n) && n > 0;
      });
      return nums.length > 0 ? parseInt(String(nums[0]).replace(/,/g, ''), 10) : 0;
    },
    // Convert raw metric → 0-100 score
    scoreMetric(value) {
      if (value >= 1000) return 95;
      if (value >= 500) return 80;
      if (value >= 250) return 60;
      if (value >= 100) return 40;
      if (value > 0) return 20;
      return 0;
    },
    metricLabel: 'contributions',
    metricUnit: 'contributions/year'
  },

  uber: {
    id: process.env.RECLAIM_PROVIDER_UBER || 'f8c4365f-8c3d-40ea-a078-29f4b59aeec5',
    name: 'Uber Driver Rating',
    shortName: 'Uber',
    category: 'gig',
    icon: 'car',
    description: 'Verified driver rating and trip count from Uber',
    weight: 0.25,
    maxRawScore: 100,
    extractMetric(params) {
      // Uber provider typically returns rating and/or trip count
      const rating = parseFloat(params.rating || params.driverRating || params.driver_rating || '0');
      const trips = parseInt(String(params.trips || params.tripCount || params.trip_count || params.totalTrips || '0').replace(/,/g, ''), 10);
      // Return an object with both metrics
      return { rating: rating || 0, trips: trips || 0 };
    },
    scoreMetric(value) {
      if (typeof value === 'object') {
        const { rating = 0, trips = 0 } = value;
        let score = 0;
        // Rating component (0-50 points)
        if (rating >= 4.8) score += 50;
        else if (rating >= 4.5) score += 40;
        else if (rating >= 4.0) score += 25;
        else if (rating > 0) score += 10;
        // Trip volume component (0-50 points)
        if (trips >= 5000) score += 50;
        else if (trips >= 1000) score += 40;
        else if (trips >= 500) score += 30;
        else if (trips >= 100) score += 20;
        else if (trips > 0) score += 10;
        return Math.min(score, 100);
      }
      return 0;
    },
    metricLabel: 'rating',
    metricUnit: 'stars'
  },

  sbi: {
    id: process.env.RECLAIM_PROVIDER_SBI || '343537da-09a8-4b34-a1dd-06a1166ff873',
    name: 'SBI Bank Statement',
    shortName: 'SBI Bank',
    category: 'financial',
    icon: 'landmark',
    description: 'Verified account balance or transaction history from SBI',
    weight: 0.25,
    maxRawScore: 100,
    extractMetric(params) {
      const balance = parseFloat(
        String(params.balance || params.accountBalance || params.account_balance ||
        params.availableBalance || params.available_balance || '0').replace(/[,₹Rs.\s]/g, '')
      );
      const monthlyIncome = parseFloat(
        String(params.monthlyIncome || params.monthly_income || params.income || '0').replace(/[,₹Rs.\s]/g, '')
      );
      return { balance, monthlyIncome };
    },
    scoreMetric(value) {
      if (typeof value === 'object') {
        const { balance = 0, monthlyIncome = 0 } = value;
        const primary = monthlyIncome > 0 ? monthlyIncome : balance;
        if (primary >= 100000) return 90;   // 1L+
        if (primary >= 50000) return 75;
        if (primary >= 25000) return 60;
        if (primary >= 10000) return 40;
        if (primary > 0) return 20;
      }
      return 0;
    },
    metricLabel: 'balance',
    metricUnit: 'INR'
  },

  linkedin: {
    id: process.env.RECLAIM_PROVIDER_LINKEDIN || '',
    name: 'LinkedIn Profile',
    shortName: 'LinkedIn',
    category: 'social',
    icon: 'linkedin',
    description: 'Verified professional profile via ZK proof',
    weight: 0.15,
    maxRawScore: 100,
    extractMetric(params) {
      // First try numeric metrics (connections, followers)
      const connections = parseInt(
        String(params.connections || params.connectionCount || params.connection_count ||
        params.followers || params.followerCount || '0').replace(/[,+\s]/g, ''), 10
      );
      if (connections > 0) return { type: 'connections', value: connections };

      // This Reclaim provider verifies profile ownership (returns username)
      const username = params.username || params.profileId || params.publicIdentifier || '';
      if (username && username.length > 0) return { type: 'profile_verified', value: 1, username };

      return { type: 'none', value: 0 };
    },
    scoreMetric(value) {
      // Handle object metric (new format)
      if (typeof value === 'object') {
        if (value.type === 'connections') {
          const c = value.value;
          if (c >= 500) return 85;
          if (c >= 200) return 65;
          if (c >= 100) return 45;
          if (c > 0) return 20;
          return 0;
        }
        // Profile verified = solid base score (proves real professional identity)
        if (value.type === 'profile_verified') return 70;
        return 0;
      }
      // Legacy: plain number (connections count)
      if (value >= 500) return 85;
      if (value >= 200) return 65;
      if (value >= 100) return 45;
      if (value > 0) return 20;
      return 0;
    },
    metricLabel: 'profile',
    metricUnit: 'verified'
  }
};

// Categories for frontend grouping
const PROVIDER_CATEGORIES = {
  developer: { label: 'Developer', description: 'Code & open source activity', icon: 'code' },
  gig: { label: 'Gig Economy', description: 'Platform work & ratings', icon: 'briefcase' },
  financial: { label: 'Financial', description: 'Banking & income', icon: 'landmark' },
  social: { label: 'Social', description: 'Professional network', icon: 'users' }
};

// Only return providers that have a valid Reclaim provider ID configured
function getActiveProviders() {
  return Object.fromEntries(
    Object.entries(PROVIDER_REGISTRY).filter(([, p]) => p.id && p.id.length > 0)
  );
}

function getProviderById(providerKey) {
  return PROVIDER_REGISTRY[providerKey] || null;
}

function getProviderCategories() {
  return PROVIDER_CATEGORIES;
}

module.exports = {
  PROVIDER_REGISTRY,
  PROVIDER_CATEGORIES,
  getActiveProviders,
  getProviderById,
  getProviderCategories
};
