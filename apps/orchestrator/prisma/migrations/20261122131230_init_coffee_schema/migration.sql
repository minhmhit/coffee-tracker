-- CreateEnum
CREATE TYPE "ForecastRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "raw_market_prices" (
    "id" SERIAL NOT NULL,
    "price_date" DATE NOT NULL,
    "price_daklak" DECIMAL(12,2) NOT NULL,
    "price_lamdong" DECIMAL(12,2) NOT NULL,
    "price_gialai" DECIMAL(12,2) NOT NULL,
    "price_daknong" DECIMAL(12,2) NOT NULL,
    "price_avg" DECIMAL(12,2) NOT NULL,
    "london_m1" DECIMAL(10,2),
    "london_m3" DECIMAL(10,2),
    "london_m6" DECIMAL(10,2),
    "usd_vnd" DECIMAL(10,2),
    "brent_oil" DECIMAL(10,2),
    "source_meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "raw_market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "macro_climate_monthly" (
    "month_date" DATE NOT NULL,
    "oni_index" DECIMAL(5,2),
    "vn_rain_anomaly" DECIMAL(8,2),
    "br_rain_anomaly" DECIMAL(8,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "macro_climate_monthly_pkey" PRIMARY KEY ("month_date")
);

-- CreateTable
CREATE TABLE "daily_signals" (
    "signal_date" DATE NOT NULL,
    "basis" DECIMAL(12,2) NOT NULL,
    "spread" DECIMAL(10,2),
    "volatility_30d" DECIMAL(10,4),
    "z_score" DECIMAL(8,4),
    "is_anomaly" BOOLEAN NOT NULL DEFAULT false,
    "regime" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_signals_pkey" PRIMARY KEY ("signal_date")
);

-- CreateTable
CREATE TABLE "forecast_runs" (
    "run_id" UUID NOT NULL,
    "forecast_date" DATE NOT NULL,
    "status" "ForecastRunStatus" NOT NULL,
    "model_version" TEXT,
    "blend_weights" JSONB,
    "metrics" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "forecast_runs_pkey" PRIMARY KEY ("run_id")
);

-- CreateTable
CREATE TABLE "forecast_predictions" (
    "id" SERIAL NOT NULL,
    "run_id" UUID NOT NULL,
    "horizon_week" INTEGER NOT NULL,
    "target_date" DATE NOT NULL,
    "pred_p10" DECIMAL(12,2) NOT NULL,
    "pred_p50" DECIMAL(12,2) NOT NULL,
    "pred_p90" DECIMAL(12,2) NOT NULL,
    "baseline_rw" DECIMAL(12,2),
    "baseline_futures" DECIMAL(12,2),
    "actual_price" DECIMAL(12,2),
    "error_pct" DECIMAL(8,4),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forecast_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raw_market_prices_price_date_key" ON "raw_market_prices"("price_date");

-- CreateIndex
CREATE INDEX "raw_market_prices_price_date_idx" ON "raw_market_prices"("price_date" DESC);

-- CreateIndex
CREATE INDEX "macro_climate_monthly_month_date_idx" ON "macro_climate_monthly"("month_date" DESC);

-- CreateIndex
CREATE INDEX "daily_signals_signal_date_idx" ON "daily_signals"("signal_date" DESC);

-- CreateIndex
CREATE INDEX "forecast_runs_forecast_date_idx" ON "forecast_runs"("forecast_date" DESC);

-- CreateIndex
CREATE INDEX "forecast_runs_status_idx" ON "forecast_runs"("status");

-- CreateIndex
CREATE INDEX "forecast_predictions_target_date_idx" ON "forecast_predictions"("target_date" DESC);

-- CreateIndex
CREATE INDEX "forecast_predictions_run_id_idx" ON "forecast_predictions"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "forecast_predictions_run_id_horizon_week_key" ON "forecast_predictions"("run_id", "horizon_week");

-- AddForeignKey
ALTER TABLE "daily_signals" ADD CONSTRAINT "daily_signals_signal_date_fkey" FOREIGN KEY ("signal_date") REFERENCES "raw_market_prices"("price_date") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forecast_predictions" ADD CONSTRAINT "forecast_predictions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "forecast_runs"("run_id") ON DELETE CASCADE ON UPDATE CASCADE;
