-- CreateTable
CREATE TABLE "User" (
    "walletAddress" TEXT NOT NULL,
    "nullifierHash" TEXT NOT NULL,
    "isHuman" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "ScoreProfile" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "computedScore" INTEGER NOT NULL,
    "aiRiskReport" TEXT NOT NULL,
    "lastTxHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isDefaulted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoreProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_nullifierHash_key" ON "User"("nullifierHash");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreProfile_walletAddress_key" ON "ScoreProfile"("walletAddress");

-- AddForeignKey
ALTER TABLE "ScoreProfile" ADD CONSTRAINT "ScoreProfile_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "User"("walletAddress") ON DELETE CASCADE ON UPDATE CASCADE;
