const { PrismaClient } = require('@prisma/client');

// Use a singleton instance to prevent connection exhaustion in development
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;
