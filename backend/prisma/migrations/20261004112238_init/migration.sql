-- CreateEnum
CREATE TYPE "Hand" AS ENUM ('RIGHT', 'LEFT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Backhand" AS ENUM ('ONE_HANDED', 'TWO_HANDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SyncJobType" AS ENUM ('RANKING', 'MATCH_RESULTS', 'MATCH_STATS', 'PLAYER_PROFILE', 'PLAYER_CAREER', 'PLAYER_TITLES', 'PLAYER_IMAGE', 'BACKFILL');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRY');

-- CreateTable
CREATE TABLE "Player" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" TIMESTAMP(3),
    "countryCode" TEXT,
    "turnedPro" INTEGER,
    "heightCm" INTEGER,
    "weightKg" INTEGER,
    "birthplace" TEXT,
    "residence" TEXT,
    "hand" "Hand" NOT NULL DEFAULT 'UNKNOWN',
    "backhand" "Backhand" NOT NULL DEFAULT 'UNKNOWN',
    "coach" TEXT,
    "status" TEXT,
    "careerHighRank" INTEGER,
    "careerHighDate" TIMESTAMP(3),
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCareerStat" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "careerWins" INTEGER,
    "careerLosses" INTEGER,
    "favouriteSurface" TEXT,
    "careerFinals" INTEGER,
    "careerTitles" INTEGER,
    "careerRunnerUps" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerCareerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "rankingDate" TIMESTAMP(3) NOT NULL,
    "rank" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" SERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "season" INTEGER,
    "courtId" INTEGER,
    "surface" TEXT,
    "countryCode" TEXT,
    "levelId" INTEGER,
    "levelName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "externalMatchId" INTEGER NOT NULL,
    "tournamentId" INTEGER,
    "matchDate" TIMESTAMP(3) NOT NULL,
    "roundId" INTEGER,
    "roundName" TEXT,
    "player1Id" INTEGER NOT NULL,
    "player2Id" INTEGER NOT NULL,
    "winnerId" INTEGER NOT NULL,
    "loserId" INTEGER NOT NULL,
    "score" TEXT,
    "status" TEXT,
    "bestOf" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchPlayerStat" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "playerId" INTEGER NOT NULL,
    "aces" INTEGER,
    "doubleFaults" INTEGER,
    "firstServe" INTEGER,
    "firstServeOf" INTEGER,
    "firstServePointsWon" INTEGER,
    "firstServePointsTotal" INTEGER,
    "secondServePointsWon" INTEGER,
    "secondServePointsTotal" INTEGER,
    "breakPointsFaced" INTEGER,
    "breakPointsSaved" INTEGER,
    "breakPointChances" INTEGER,
    "breakPointsWon" INTEGER,
    "winners" INTEGER,
    "unforcedErrors" INTEGER,
    "netApproaches" INTEGER,
    "netApproachesTotal" INTEGER,
    "totalPointsWon" INTEGER,
    "fastestServe" TEXT,
    "averageFirstServeSpeed" TEXT,
    "averageSecondServeSpeed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerTitle" (
    "id" SERIAL NOT NULL,
    "playerId" INTEGER NOT NULL,
    "tourRankId" INTEGER NOT NULL,
    "tourRankName" TEXT NOT NULL,
    "titlesWon" INTEGER NOT NULL,
    "finalsLost" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" SERIAL NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "targetKey" TEXT,
    "payload" JSONB,
    "requestsUsed" INTEGER NOT NULL DEFAULT 0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerCareerStat_playerId_key" ON "PlayerCareerStat"("playerId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_rankingDate_idx" ON "RankingSnapshot"("rankingDate");

-- CreateIndex
CREATE INDEX "RankingSnapshot_rank_idx" ON "RankingSnapshot"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "RankingSnapshot_playerId_rankingDate_key" ON "RankingSnapshot"("playerId", "rankingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Tournament_externalId_key" ON "Tournament"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_externalMatchId_key" ON "Match"("externalMatchId");

-- CreateIndex
CREATE INDEX "Match_matchDate_idx" ON "Match"("matchDate");

-- CreateIndex
CREATE INDEX "Match_winnerId_idx" ON "Match"("winnerId");

-- CreateIndex
CREATE INDEX "Match_loserId_idx" ON "Match"("loserId");

-- CreateIndex
CREATE INDEX "Match_player1Id_idx" ON "Match"("player1Id");

-- CreateIndex
CREATE INDEX "Match_player2Id_idx" ON "Match"("player2Id");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayerStat_matchId_playerId_key" ON "MatchPlayerStat"("matchId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerTitle_playerId_tourRankId_key" ON "PlayerTitle"("playerId", "tourRankId");

-- CreateIndex
CREATE INDEX "SyncJob_type_status_idx" ON "SyncJob"("type", "status");

-- CreateIndex
CREATE INDEX "SyncJob_scheduledFor_idx" ON "SyncJob"("scheduledFor");

-- AddForeignKey
ALTER TABLE "PlayerCareerStat" ADD CONSTRAINT "PlayerCareerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player1Id_fkey" FOREIGN KEY ("player1Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_player2Id_fkey" FOREIGN KEY ("player2Id") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_loserId_fkey" FOREIGN KEY ("loserId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerTitle" ADD CONSTRAINT "PlayerTitle_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
