-- CreateTable
CREATE TABLE "daily_weather" (
    "id" SERIAL NOT NULL,
    "weather_date" DATE NOT NULL,
    "province_code" TEXT NOT NULL,
    "province_name" TEXT NOT NULL,
    "temp_current" DECIMAL(5,2),
    "temp_min" DECIMAL(5,2) NOT NULL,
    "temp_max" DECIMAL(5,2) NOT NULL,
    "precipitation_mm" DECIMAL(7,2) NOT NULL,
    "rain_probability" INTEGER,
    "humidity_pct" INTEGER,
    "wind_speed_kmh" DECIMAL(6,2),
    "weather_code" INTEGER NOT NULL,
    "condition_vi" TEXT NOT NULL,
    "farming_impact_vi" TEXT NOT NULL,
    "raw_meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "daily_weather_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ice_robusta_stocks" (
    "id" SERIAL NOT NULL,
    "report_date" DATE NOT NULL,
    "certified_lots" INTEGER NOT NULL,
    "certified_tonnes" DECIMAL(12,2) NOT NULL,
    "dod_change_lots" INTEGER,
    "source_name" TEXT NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "raw_meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ice_robusta_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_subscribers" (
    "id" SERIAL NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "subscribed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "telegram_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_weather_weather_date_idx" ON "daily_weather"("weather_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_weather_weather_date_province_code_key" ON "daily_weather"("weather_date", "province_code");

-- CreateIndex
CREATE UNIQUE INDEX "ice_robusta_stocks_report_date_key" ON "ice_robusta_stocks"("report_date");

-- CreateIndex
CREATE INDEX "ice_robusta_stocks_report_date_idx" ON "ice_robusta_stocks"("report_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_subscribers_chat_id_key" ON "telegram_subscribers"("chat_id");

-- CreateIndex
CREATE INDEX "telegram_subscribers_is_active_idx" ON "telegram_subscribers"("is_active");
