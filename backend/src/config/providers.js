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
    weight: 0.20,                // weight in composite score
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
    weight: 0.20,
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
    weight: 0.20,
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
    weight: 0.10,
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
  },

  twitter: {
    id: process.env.RECLAIM_PROVIDER_TWITTER || '',
    name: 'Twitter User Profile',
    shortName: 'Twitter',
    category: 'social',
    icon: 'twitter',
    description: 'Verified Twitter profile with follower count',
    weight: 0.10,
    maxRawScore: 100,
    extractMetric(params) {
      const followers = parseInt(
        String(params.followers || params.followerCount || params.follower_count ||
        params.followersCount || params.followers_count || '0').replace(/[,\s]/g, ''), 10
      );
      if (followers > 0) return { type: 'followers', value: followers };

      const username = params.username || params.screen_name || params.screenName || params.handle || '';
      if (username && username.length > 0) return { type: 'profile_verified', value: 1, username };

      // Numeric fallback
      const nums = Object.values(params).filter(v => {
        const n = parseInt(String(v).replace(/[,\s]/g, ''), 10);
        return !isNaN(n) && n > 0;
      });
      return nums.length > 0 ? { type: 'followers', value: parseInt(String(nums[0]).replace(/[,\s]/g, ''), 10) } : { type: 'none', value: 0 };
    },
    scoreMetric(value) {
      if (typeof value === 'object') {
        if (value.type === 'followers') {
          const f = value.value;
          if (f >= 10000) return 90;
          if (f >= 5000) return 75;
          if (f >= 1000) return 60;
          if (f >= 500) return 45;
          if (f >= 100) return 30;
          if (f > 0) return 15;
          return 0;
        }
        if (value.type === 'profile_verified') return 50;
        return 0;
      }
      return 0;
    },
    metricLabel: 'followers',
    metricUnit: 'followers'
  },

  netflix: {
    id: process.env.RECLAIM_PROVIDER_NETFLIX || '',
    name: 'Netflix Watch History',
    shortName: 'Netflix',
    category: 'entertainment',
    icon: 'tv',
    description: 'Verified Netflix subscription and watch history',
    weight: 0.05,
    maxRawScore: 100,
    extractMetric(params) {
      const watchCount = parseInt(
        String(params.watchCount || params.watch_count || params.titlesWatched ||
        params.titles_watched || params.viewingHistory || params.totalWatched || '0').replace(/[,\s]/g, ''), 10
      );
      if (watchCount > 0) return { type: 'watch_count', value: watchCount };

      const membership = params.membership || params.plan || params.membershipType || params.subscription || '';
      if (membership && membership.length > 0) return { type: 'membership', value: 1, plan: membership };

      // Profile verified fallback
      const username = params.username || params.profileName || params.profile_name || '';
      if (username && username.length > 0) return { type: 'profile_verified', value: 1, username };

      return { type: 'none', value: 0 };
    },
    scoreMetric(value) {
      if (typeof value === 'object') {
        if (value.type === 'watch_count') {
          const w = value.value;
          if (w >= 500) return 80;
          if (w >= 200) return 60;
          if (w >= 50) return 40;
          if (w > 0) return 20;
          return 0;
        }
        if (value.type === 'membership') return 55;
        if (value.type === 'profile_verified') return 40;
        return 0;
      }
      return 0;
    },
    metricLabel: 'titles watched',
    metricUnit: 'titles'
  },

  discord: {
    id: process.env.RECLAIM_PROVIDER_DISCORD || '',
    name: 'Discord Channel',
    shortName: 'Discord',
    category: 'social',
    icon: 'message-circle',
    description: 'Verified Discord server membership and activity',
    weight: 0.05,
    maxRawScore: 100,
    extractMetric(params) {
      const servers = parseInt(
        String(params.servers || params.serverCount || params.server_count ||
        params.guilds || params.guildCount || '0').replace(/[,\s]/g, ''), 10
      );
      if (servers > 0) return { type: 'servers', value: servers };

      const channelId = params.channelId || params.channel_id || params.serverId || params.server_id || '';
      if (channelId && channelId.length > 0) return { type: 'channel_verified', value: 1, channelId };

      const username = params.username || params.discriminator || params.user || '';
      if (username && username.length > 0) return { type: 'profile_verified', value: 1, username };

      return { type: 'none', value: 0 };
    },
    scoreMetric(value) {
      if (typeof value === 'object') {
        if (value.type === 'servers') {
          const s = value.value;
          if (s >= 50) return 75;
          if (s >= 20) return 55;
          if (s >= 10) return 40;
          if (s > 0) return 25;
          return 0;
        }
        if (value.type === 'channel_verified') return 50;
        if (value.type === 'profile_verified') return 45;
        return 0;
      }
      return 0;
    },
    metricLabel: 'servers',
    metricUnit: 'servers'
  },

  amazon: {
    id: process.env.RECLAIM_PROVIDER_AMAZON || '',
    name: 'Amazon Order History',
    shortName: 'Amazon',
    category: 'ecommerce',
    icon: 'shopping-cart',
    description: 'Verified Amazon order history and purchase activity',
    weight: 0.10,
    maxRawScore: 100,
    extractMetric(params) {
      // Try to extract order count or total spend
      const orderCount = parseInt(
        String(params.orderCount || params.order_count || params.orders ||
        params.totalOrders || params.total_orders || '0').replace(/[,\s]/g, ''), 10
      );
      if (orderCount > 0) return { type: 'order_count', value: orderCount };

      // Try total spend amount
      const totalSpend = parseFloat(
        String(params.totalSpend || params.total_spend || params.amount ||
        params.totalAmount || params.total_amount || params.orderTotal || '0').replace(/[,₹$\s]/g, '')
      );
      if (totalSpend > 0) return { type: 'total_spend', value: totalSpend };

      // Last order details fallback — proves account ownership
      const lastOrder = params.lastOrder || params.last_order || params.orderDetails ||
        params.order_details || params.itemName || params.item_name || '';
      if (lastOrder && lastOrder.length > 0) return { type: 'order_verified', value: 1, details: lastOrder };

      // Any string value = proof of account
      const anyVal = Object.values(params).find(v => typeof v === 'string' && v.length > 2);
      if (anyVal) return { type: 'account_verified', value: 1 };

      return { type: 'none', value: 0 };
    },
    scoreMetric(value) {
      if (typeof value === 'object') {
        if (value.type === 'order_count') {
          const o = value.value;
          if (o >= 100) return 85;
          if (o >= 50) return 70;
          if (o >= 20) return 55;
          if (o >= 5) return 35;
          if (o > 0) return 20;
          return 0;
        }
        if (value.type === 'total_spend') {
          const s = value.value;
          if (s >= 100000) return 90;
          if (s >= 50000) return 75;
          if (s >= 20000) return 60;
          if (s >= 5000) return 40;
          if (s > 0) return 20;
          return 0;
        }
        if (value.type === 'order_verified') return 55;
        if (value.type === 'account_verified') return 40;
        return 0;
      }
      return 0;
    },
    metricLabel: 'orders',
    metricUnit: 'orders'
  }
};

// Categories for frontend grouping
const PROVIDER_CATEGORIES = {
  developer: { label: 'Developer', description: 'Code & open source activity', icon: 'code' },
  gig: { label: 'Gig Economy', description: 'Platform work & ratings', icon: 'briefcase' },
  financial: { label: 'Financial', description: 'Banking & income', icon: 'landmark' },
  social: { label: 'Social', description: 'Professional & social networks', icon: 'users' },
  entertainment: { label: 'Entertainment', description: 'Streaming & media subscriptions', icon: 'tv' },
  ecommerce: { label: 'E-Commerce', description: 'Online shopping & purchase history', icon: 'shopping-cart' }
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
