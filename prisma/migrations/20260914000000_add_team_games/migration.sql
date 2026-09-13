CREATE TABLE IF NOT EXISTS "TeamGame" (
    "id" TEXT NOT NULL,
    "teamId" INTEGER NOT NULL,
    "teamAbbr" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameDate" TIMESTAMP(3) NOT NULL,
    "season" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TeamGame_teamId_gameId_key" ON "TeamGame"("teamId", "gameId");
CREATE INDEX IF NOT EXISTS "TeamGame_teamId_season_gameDate_idx" ON "TeamGame"("teamId", "season", "gameDate");
