-- AlterTable
ALTER TABLE "NbaSyncState" ADD COLUMN IF NOT EXISTS "playersProcessed" INTEGER;
ALTER TABLE "NbaSyncState" ADD COLUMN IF NOT EXISTS "seasonStatsProcessed" INTEGER;
ALTER TABLE "NbaSyncState" ADD COLUMN IF NOT EXISTS "gameLogsProcessed" INTEGER;

-- CreateTable
CREATE TABLE "PlayerSeasonStats" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "gamesPlayed" INTEGER NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "rebounds" DOUBLE PRECISION NOT NULL,
    "assists" DOUBLE PRECISION NOT NULL,
    "steals" DOUBLE PRECISION NOT NULL,
    "blocks" DOUBLE PRECISION NOT NULL,
    "turnovers" DOUBLE PRECISION NOT NULL,
    "fieldGoalsMade" DOUBLE PRECISION NOT NULL,
    "fieldGoalsAttempted" DOUBLE PRECISION NOT NULL,
    "threePointersMade" DOUBLE PRECISION NOT NULL,
    "threePointersAttempted" DOUBLE PRECISION NOT NULL,
    "freeThrowsMade" DOUBLE PRECISION NOT NULL,
    "freeThrowsAttempted" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "minutes" DOUBLE PRECISION NOT NULL,
    "points" INTEGER NOT NULL,
    "rebounds" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "steals" INTEGER NOT NULL,
    "blocks" INTEGER NOT NULL,
    "turnovers" INTEGER NOT NULL,
    "fieldGoalsMade" INTEGER NOT NULL,
    "fieldGoalsAttempted" INTEGER NOT NULL,
    "threePointersMade" INTEGER NOT NULL,
    "threePointersAttempted" INTEGER NOT NULL,
    "freeThrowsMade" INTEGER NOT NULL,
    "freeThrowsAttempted" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerGameLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStats_playerId_season_key" ON "PlayerSeasonStats"("playerId", "season");

-- CreateIndex
CREATE INDEX "PlayerSeasonStats_season_idx" ON "PlayerSeasonStats"("season");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameLog_playerId_gameId_key" ON "PlayerGameLog"("playerId", "gameId");

-- CreateIndex
CREATE INDEX "PlayerGameLog_playerId_gameDate_idx" ON "PlayerGameLog"("playerId", "gameDate");

-- AddForeignKey
ALTER TABLE "PlayerSeasonStats" ADD CONSTRAINT "PlayerSeasonStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameLog" ADD CONSTRAINT "PlayerGameLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
