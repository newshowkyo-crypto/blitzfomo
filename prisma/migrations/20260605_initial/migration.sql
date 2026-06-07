-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('RECHARGE', 'PURCHASE', 'WIN', 'WITHDRAW_FROZEN', 'WITHDRAW_REFUND', 'MANUAL_ADJUST', 'PLATFORM_FEE', 'BOT_COMPENSATION');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('OPEN', 'SETTLING', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('REQUESTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "RoadEconomyMode" AS ENUM ('COLD_START', 'NORMAL_GROWTH', 'KNOCKOUT_FOMO', 'FINAL_RUSH');

-- CreateEnum
CREATE TYPE "RoadStage" AS ENUM ('GROUP', 'TOP32', 'TOP16', 'TOP8', 'TOP4', 'FINAL', 'CHAMPION');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ADVANCED', 'ELIMINATED', 'CHAMPION');

-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HoldingStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'CLOSED');

-- CreateEnum
CREATE TYPE "RewardStatus" AS ENUM ('PENDING_RELEASE', 'RELEASED', 'REINVESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RoadDividendSource" AS ENUM ('PURCHASE', 'STAGE_REWARD');

-- CreateEnum
CREATE TYPE "JackpotStatus" AS ENUM ('ACTIVE', 'SETTLED');

-- CreateEnum
CREATE TYPE "SponsorSource" AS ENUM ('OFFICIAL');

-- CreateEnum
CREATE TYPE "RoadTreasuryEventType" AS ENUM ('PURCHASE', 'SPONSOR_INJECT', 'REWARD_RELEASE', 'COMMISSION_RELEASE', 'COMMISSION_CANCEL', 'STAGE_ADVANCE', 'TEAM_ELIMINATION', 'POOL_CLOSE');

-- CreateEnum
CREATE TYPE "RoadTreasuryBucket" AS ENUM ('PLATFORM_FEE', 'POOL_PRIZE', 'PENDING_REWARD', 'SUPER_JACKPOT', 'REINVEST_POOL', 'AGENT_POOL', 'RESERVE', 'PLATFORM_CARRY', 'OFFICIAL_SPONSOR_COST', 'SURVIVOR_PUBLIC_POOL', 'ACTIVITY_BUDGET', 'USER_RELEASED');

-- CreateEnum
CREATE TYPE "OfficialBudgetStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RoadKolStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "RoadCommissionStatus" AS ENUM ('PENDING', 'RELEASED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "total_purchased" BIGINT NOT NULL DEFAULT 0,
    "total_won" BIGINT NOT NULL DEFAULT 0,
    "is_frozen" BOOLEAN NOT NULL DEFAULT false,
    "frozen_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "round_id" TEXT,
    "purchase_id" TEXT,
    "payment_id" TEXT,
    "withdrawal_id" TEXT,
    "type" "LedgerType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_before" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "description" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "prize_pool" BIGINT NOT NULL,
    "initial_pool" BIGINT NOT NULL,
    "winner_amount" BIGINT,
    "platform_fee" BIGINT,
    "status" "RoundStatus" NOT NULL DEFAULT 'OPEN',
    "started_at" TIMESTAMP(3) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),
    "last_buyer_user_id" TEXT,
    "last_buyer_nickname" TEXT,
    "winner_user_id" TEXT,
    "winner_nickname" TEXT,
    "is_bot_winner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "bf_to_usdt_rate" INTEGER NOT NULL DEFAULT 100,
    "initial_prize_pool" BIGINT NOT NULL,
    "winner_percent" INTEGER NOT NULL DEFAULT 70,
    "platform_percent" INTEGER NOT NULL DEFAULT 30,
    "countdown_seconds" INTEGER NOT NULL DEFAULT 60,
    "min_buy_amount" BIGINT NOT NULL,
    "tournament_map_url" TEXT,
    "active_payment_gateway" TEXT NOT NULL DEFAULT 'mock',
    "bot_enabled" BOOLEAN NOT NULL DEFAULT true,
    "bot_purchase_interval_ms" INTEGER NOT NULL DEFAULT 8000,
    "bot_min_amount" BIGINT NOT NULL,
    "bot_max_amount" BIGINT NOT NULL,
    "updated_by_admin_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "withdraw_min_amount" BIGINT NOT NULL,
    "withdraw_max_amount_daily" BIGINT NOT NULL,
    "withdraw_require_purchase_count" INTEGER NOT NULL,
    "withdraw_cooldown_hours" INTEGER NOT NULL,
    "purchase_max_amount_per_tx" BIGINT NOT NULL,
    "purchase_rate_limit_per_min" INTEGER NOT NULL,
    "large_amount_threshold" BIGINT NOT NULL,
    "updated_by_admin_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "gateway_order_id" TEXT,
    "amount_usdt" BIGINT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "callback_raw" JSONB,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount_usdt" BIGINT NOT NULL,
    "to_address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'TON',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'REQUESTED',
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_reason" TEXT,
    "reviewed_by_admin_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "paid_remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_log" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locales" (
    "id" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "content" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "flagUrl" TEXT,
    "groupCode" TEXT,
    "strengthFactor" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "impliedTop32" DECIMAL(10,6),
    "impliedTop16" DECIMAL(10,6),
    "impliedTop8" DECIMAL(10,6),
    "impliedTop4" DECIMAL(10,6),
    "impliedFinal" DECIMAL(10,6),
    "impliedChampion" DECIMAL(10,6),
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStage" "RoadStage" NOT NULL DEFAULT 'GROUP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_pools" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "stage" "RoadStage" NOT NULL,
    "status" "PoolStatus" NOT NULL DEFAULT 'OPEN',
    "basePrice" BIGINT NOT NULL,
    "currentPrice" BIGINT NOT NULL,
    "soldKeys" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "totalPurchases" BIGINT NOT NULL DEFAULT 0,
    "prizePool" BIGINT NOT NULL DEFAULT 0,
    "dividendPaid" BIGINT NOT NULL DEFAULT 0,
    "superPoolContrib" BIGINT NOT NULL DEFAULT 0,
    "reserveContrib" BIGINT NOT NULL DEFAULT 0,
    "sponsorAmount" BIGINT NOT NULL DEFAULT 0,
    "sponsorBudgetLimit" BIGINT NOT NULL DEFAULT 0,
    "openAt" TIMESTAMP(3),
    "closeAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "params" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_key_holdings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "keyAmount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "costAmount" BIGINT NOT NULL,
    "avgEntryPrice" BIGINT NOT NULL,
    "genesisBoost" DECIMAL(10,4) NOT NULL DEFAULT 1.0,
    "pendingReward" BIGINT NOT NULL DEFAULT 0,
    "releasedReward" BIGINT NOT NULL DEFAULT 0,
    "status" "HoldingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_key_holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "keyAmount" DECIMAL(36,18) NOT NULL,
    "priceSnapshot" BIGINT NOT NULL,
    "houseFee" BIGINT NOT NULL,
    "prizePart" BIGINT NOT NULL,
    "dividendPart" BIGINT NOT NULL,
    "superPart" BIGINT NOT NULL,
    "reinvestPart" BIGINT NOT NULL,
    "agentPart" BIGINT NOT NULL,
    "reservePart" BIGINT NOT NULL,
    "referralCode" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_dividends" (
    "id" TEXT NOT NULL,
    "source" "RoadDividendSource" NOT NULL DEFAULT 'PURCHASE',
    "purchaseId" TEXT,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "weight" DECIMAL(36,18) NOT NULL,
    "status" "RewardStatus" NOT NULL DEFAULT 'PENDING_RELEASE',
    "releaseAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "super_jackpot" (
    "id" TEXT NOT NULL,
    "seasonCode" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "status" "JackpotStatus" NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_jackpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_ledger" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "source" "SponsorSource" NOT NULL DEFAULT 'OFFICIAL',
    "operatorId" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsor_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_treasury_ledger" (
    "id" TEXT NOT NULL,
    "seasonCode" TEXT NOT NULL,
    "eventType" "RoadTreasuryEventType" NOT NULL,
    "eventId" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "bucket" "RoadTreasuryBucket" NOT NULL,
    "amount" BIGINT NOT NULL,
    "poolId" TEXT,
    "purchaseId" TEXT,
    "sponsorLedgerId" TEXT,
    "dividendId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_treasury_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "season_code" TEXT NOT NULL,
    "economy_mode" "RoadEconomyMode" NOT NULL DEFAULT 'NORMAL_GROWTH',
    "base_house_fee_bps" INTEGER NOT NULL DEFAULT 600,
    "min_house_fee_bps" INTEGER NOT NULL DEFAULT 500,
    "max_house_fee_bps" INTEGER NOT NULL DEFAULT 2000,
    "base_dividend_bps" INTEGER NOT NULL DEFAULT 2800,
    "min_dividend_bps" INTEGER NOT NULL DEFAULT 600,
    "max_dividend_bps" INTEGER NOT NULL DEFAULT 3200,
    "prize_bps" INTEGER NOT NULL DEFAULT 3200,
    "super_bps" INTEGER NOT NULL DEFAULT 1500,
    "reinvest_bps" INTEGER NOT NULL DEFAULT 1000,
    "agent_bps" INTEGER NOT NULL DEFAULT 1000,
    "reserve_bps" INTEGER NOT NULL DEFAULT 500,
    "min_super_bps" INTEGER NOT NULL DEFAULT 1000,
    "max_super_bps" INTEGER NOT NULL DEFAULT 4500,
    "min_reserve_bps" INTEGER NOT NULL DEFAULT 500,
    "max_reserve_bps" INTEGER NOT NULL DEFAULT 1800,
    "daily_rush_bps" INTEGER NOT NULL DEFAULT 200,
    "mega_pool_bps" INTEGER NOT NULL DEFAULT 500,
    "withdrawal_pressure_threshold_bps" INTEGER NOT NULL DEFAULT 3000,
    "volume_growth_boost_cap_bps" INTEGER NOT NULL DEFAULT 300,
    "release_delay_hours" INTEGER NOT NULL DEFAULT 24,
    "release_delay_min_hours" INTEGER NOT NULL DEFAULT 12,
    "release_delay_max_hours" INTEGER NOT NULL DEFAULT 72,
    "low_coverage_threshold_bps" INTEGER NOT NULL DEFAULT 10000,
    "sponsor_global_budget" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "official_sponsor_budget" (
    "id" TEXT NOT NULL,
    "season_code" TEXT NOT NULL,
    "total_budget" BIGINT NOT NULL,
    "used_budget" BIGINT NOT NULL DEFAULT 0,
    "remaining_budget" BIGINT NOT NULL,
    "status" "OfficialBudgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "official_sponsor_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_kol" (
    "id" TEXT NOT NULL,
    "season_code" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "status" "RoadKolStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "road_kol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_referral_commission" (
    "id" TEXT NOT NULL,
    "season_code" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "inviter_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "purchase_id" TEXT NOT NULL,
    "commission_amount" BIGINT NOT NULL,
    "status" "RoadCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "release_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_referral_commission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE INDEX "ledger_user_id_created_at_idx" ON "ledger"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_round_id_idx" ON "ledger"("round_id");

-- CreateIndex
CREATE INDEX "ledger_type_idx" ON "ledger"("type");

-- CreateIndex
CREATE UNIQUE INDEX "rounds_round_number_key" ON "rounds"("round_number");

-- CreateIndex
CREATE INDEX "rounds_status_deadline_at_idx" ON "rounds"("status", "deadline_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_idempotency_key_key" ON "purchases"("idempotency_key");

-- CreateIndex
CREATE INDEX "purchases_round_id_created_at_idx" ON "purchases"("round_id", "created_at");

-- CreateIndex
CREATE INDEX "purchases_user_id_idx" ON "purchases"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_user_id_status_idx" ON "payments"("user_id", "status");

-- CreateIndex
CREATE INDEX "withdrawals_user_id_status_idx" ON "withdrawals"("user_id", "status");

-- CreateIndex
CREATE INDEX "withdrawals_status_created_at_idx" ON "withdrawals"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE INDEX "admin_audit_log_admin_id_created_at_idx" ON "admin_audit_log"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log"("action");

-- CreateIndex
CREATE UNIQUE INDEX "locales_lang_key" ON "locales"("lang");

-- CreateIndex
CREATE INDEX "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "teams_code_key" ON "teams"("code");

-- CreateIndex
CREATE INDEX "road_pools_status_stage_idx" ON "road_pools"("status", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "road_pools_teamId_stage_key" ON "road_pools"("teamId", "stage");

-- CreateIndex
CREATE INDEX "road_key_holdings_poolId_status_idx" ON "road_key_holdings"("poolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "road_key_holdings_userId_poolId_key" ON "road_key_holdings"("userId", "poolId");

-- CreateIndex
CREATE UNIQUE INDEX "road_purchases_idempotencyKey_key" ON "road_purchases"("idempotencyKey");

-- CreateIndex
CREATE INDEX "road_purchases_poolId_createdAt_idx" ON "road_purchases"("poolId", "createdAt");

-- CreateIndex
CREATE INDEX "road_purchases_userId_createdAt_idx" ON "road_purchases"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "road_dividends_userId_status_idx" ON "road_dividends"("userId", "status");

-- CreateIndex
CREATE INDEX "road_dividends_poolId_idx" ON "road_dividends"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "super_jackpot_seasonCode_key" ON "super_jackpot"("seasonCode");

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_ledger_reference_key" ON "sponsor_ledger"("reference");

-- CreateIndex
CREATE INDEX "sponsor_ledger_poolId_createdAt_idx" ON "sponsor_ledger"("poolId", "createdAt");

-- CreateIndex
CREATE INDEX "road_treasury_ledger_seasonCode_bucket_idx" ON "road_treasury_ledger"("seasonCode", "bucket");

-- CreateIndex
CREATE INDEX "road_treasury_ledger_poolId_idx" ON "road_treasury_ledger"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "road_treasury_ledger_eventType_eventId_entryKey_key" ON "road_treasury_ledger"("eventType", "eventId", "entryKey");

-- CreateIndex
CREATE UNIQUE INDEX "road_config_season_code_key" ON "road_config"("season_code");

-- CreateIndex
CREATE UNIQUE INDEX "official_sponsor_budget_season_code_key" ON "official_sponsor_budget"("season_code");

-- CreateIndex
CREATE UNIQUE INDEX "road_kol_referral_code_key" ON "road_kol"("referral_code");

-- CreateIndex
CREATE INDEX "road_kol_season_code_status_idx" ON "road_kol"("season_code", "status");

-- CreateIndex
CREATE UNIQUE INDEX "road_referral_commission_purchase_id_key" ON "road_referral_commission"("purchase_id");

-- CreateIndex
CREATE INDEX "road_referral_commission_inviter_id_status_idx" ON "road_referral_commission"("inviter_id", "status");

-- CreateIndex
CREATE INDEX "road_referral_commission_referred_user_id_idx" ON "road_referral_commission"("referred_user_id");

-- CreateIndex
CREATE INDEX "road_referral_commission_season_code_status_idx" ON "road_referral_commission"("season_code", "status");

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger" ADD CONSTRAINT "ledger_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_pools" ADD CONSTRAINT "road_pools_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_key_holdings" ADD CONSTRAINT "road_key_holdings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_key_holdings" ADD CONSTRAINT "road_key_holdings_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "road_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_purchases" ADD CONSTRAINT "road_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_purchases" ADD CONSTRAINT "road_purchases_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "road_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_dividends" ADD CONSTRAINT "road_dividends_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "road_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_dividends" ADD CONSTRAINT "road_dividends_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "road_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_dividends" ADD CONSTRAINT "road_dividends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_ledger" ADD CONSTRAINT "sponsor_ledger_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "road_pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_ledger" ADD CONSTRAINT "sponsor_ledger_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_treasury_ledger" ADD CONSTRAINT "road_treasury_ledger_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "road_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_treasury_ledger" ADD CONSTRAINT "road_treasury_ledger_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "road_purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_treasury_ledger" ADD CONSTRAINT "road_treasury_ledger_sponsorLedgerId_fkey" FOREIGN KEY ("sponsorLedgerId") REFERENCES "sponsor_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_treasury_ledger" ADD CONSTRAINT "road_treasury_ledger_dividendId_fkey" FOREIGN KEY ("dividendId") REFERENCES "road_dividends"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_kol" ADD CONSTRAINT "road_kol_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_referral_commission" ADD CONSTRAINT "road_referral_commission_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_referral_commission" ADD CONSTRAINT "road_referral_commission_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_referral_commission" ADD CONSTRAINT "road_referral_commission_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "road_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

