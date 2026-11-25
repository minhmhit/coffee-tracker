import { Injectable, Logger } from '@nestjs/common';
import {
  DailySignal,
  DailyWeather,
  ForecastPrediction,
  ForecastRun,
  IceRobustaStock,
  MacroClimateMonthly,
  RawMarketPrice,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForecastMilestoneSummary,
  ForecastTransparencySummary,
  InsightFactorCard,
  InsightTrend,
  MarketInsightsResponse,
  MarketStance,
} from './insights.dto';

interface ForecastRunWithPredictions extends ForecastRun {
  predictions: ForecastPrediction[];
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes deterministic, quantitative market insights and transparent forecast explanations
   * directly from verified PostgreSQL records (<50ms typical latency, zero LLM hallucination).
   */
  async getLatestInsights(): Promise<MarketInsightsResponse> {
    const [prices, latestSignal, stocks, weatherRows, climateRows, latestForecast] =
      await Promise.all([
        this.prisma.rawMarketPrice.findMany({
          orderBy: { price_date: 'desc' },
          take: 35,
        }),
        this.prisma.dailySignal.findFirst({
          orderBy: { signal_date: 'desc' },
        }),
        this.prisma.iceRobustaStock.findMany({
          orderBy: { report_date: 'desc' },
          take: 35,
        }),
        this.prisma.dailyWeather.findMany({
          orderBy: [{ weather_date: 'desc' }, { province_code: 'asc' }],
          take: 4,
        }),
        this.prisma.macroClimateMonthly.findMany({
          orderBy: { month_date: 'desc' },
          take: 12,
        }),
        this.prisma.forecastRun.findFirst({
          where: { status: 'SUCCESS' },
          orderBy: { forecast_date: 'desc' },
          include: {
            predictions: {
              orderBy: { horizon_week: 'asc' },
            },
          },
        }),
      ]);

    const latestPrice = prices[0] ?? null;
    const asOfDate = latestPrice
      ? this.toIsoDate(latestPrice.price_date)
      : weatherRows[0]
      ? this.toIsoDate(weatherRows[0].weather_date)
      : this.todayIsoVn();

    const oilCard = this.analyzeOil(prices);
    const inventoryCard = this.analyzeInventoryAndSupply(stocks, latestSignal, latestPrice);
    const fxCard = this.analyzeFx(prices);
    const weatherCard = this.analyzeWeatherAndClimate(weatherRows, climateRows);

    const forecastTransparency = this.analyzeForecastTransparency(
      latestForecast as ForecastRunWithPredictions | null,
      latestPrice,
    );

    const overallStance = this.computeOverallStance(
      inventoryCard,
      fxCard,
      oilCard,
      forecastTransparency,
    );

    const executiveSummary = this.buildExecutiveSummary({
      latestPrice,
      latestSignal,
      inventoryCard,
      oilCard,
      weatherCard,
      forecastTransparency,
    });

    return {
      generated_at: new Date().toISOString(),
      as_of_date: asOfDate,
      overall_stance: overallStance,
      executive_summary: executiveSummary,
      factors: [oilCard, inventoryCard, fxCard, weatherCard],
      forecast_transparency: forecastTransparency,
    };
  }

  analyzeOil(prices: RawMarketPrice[]): InsightFactorCard {
    const valid = prices
      .filter((p) => p.brent_oil !== null)
      .map((p) => ({
        date: this.toIsoDate(p.price_date),
        val: p.brent_oil!.toNumber(),
      }));

    if (valid.length === 0) {
      return {
        key: 'oil',
        title: 'Giá dầu thô Brent',
        trend: 'NEUTRAL',
        badge_label: 'CHƯA CÓ DỮ LIỆU',
        metric_value: 'N/A',
        metric_source: 'Yahoo Finance (BZ=F)',
        explanation: 'Chưa có dữ liệu giá dầu thô Brent trong cơ sở dữ liệu.',
        impact_on_coffee: 'Chưa thể đánh giá tác động chi phí vận tải biển.',
        details: {},
      };
    }

    const latest = valid[0].val;
    const ref7d = valid[Math.min(7, valid.length - 1)].val;
    const ref30d = valid[valid.length - 1].val;
    const ma30 = valid.reduce((sum, x) => sum + x.val, 0) / valid.length;

    const delta7dPct = ref7d > 0 && valid.length > 1 ? ((latest - ref7d) / ref7d) * 100 : 0;
    const delta30dPct = ref30d > 0 && valid.length > 1 ? ((latest - ref30d) / ref30d) * 100 : 0;

    let trend: InsightTrend = 'NEUTRAL';
    let badgeLabel = `ĐI NGANG (${this.formatSignedPct(delta7dPct)} / 7N)`;
    let impactOnCoffee =
      'Chi phí nhiên liệu và cước vận tải biển biến động hẹp, giữ tác động trung tính lên giá thành xuất khẩu cà phê.';

    if (delta7dPct >= 1.5) {
      trend = 'UP';
      badgeLabel = `TĂNG (${this.formatSignedPct(delta7dPct)} / 7N)`;
      impactOnCoffee =
        'Giá dầu tăng làm chi phí vận tải biển và logistics từ Việt Nam đi châu Âu có xu hướng nhích lên, gián tiếp nâng đỡ giá CIF.';
    } else if (delta7dPct <= -1.5) {
      trend = 'DOWN';
      badgeLabel = `GIẢM (${this.formatSignedPct(delta7dPct)} / 7N)`;
      impactOnCoffee =
        'Giá dầu hạ nhiệt giúp giảm áp lực chi phí nhiên liệu và vận tải biển, cải thiện biên chi phí xuất khẩu.';
    }

    const maRelation =
      latest >= ma30
        ? `cao hơn mức trung bình ${valid.length} ngày ($${ma30.toFixed(2)}/thùng)`
        : `thấp hơn mức trung bình ${valid.length} ngày ($${ma30.toFixed(2)}/thùng)`;

    const explanation = `Giá dầu Brent hiện ở mức $${latest.toFixed(2)}/thùng (${this.formatSignedPct(
      delta7dPct,
    )} trong 7 ngày so với $${ref7d.toFixed(2)}/thùng; ${this.formatSignedPct(
      delta30dPct,
    )} trong ${valid.length} ngày) và đang ${maRelation}.`;

    return {
      key: 'oil',
      title: 'Giá dầu thô Brent',
      trend,
      badge_label: badgeLabel,
      metric_value: `$${latest.toFixed(2)}/thùng`,
      metric_source: 'Yahoo Finance (BZ=F)',
      explanation,
      impact_on_coffee: impactOnCoffee,
      details: {
        latest: Number(latest.toFixed(2)),
        ma30: Number(ma30.toFixed(2)),
        delta_7d_pct: Number(delta7dPct.toFixed(2)),
        delta_30d_pct: Number(delta30dPct.toFixed(2)),
      },
    };
  }

  analyzeInventoryAndSupply(
    stocks: IceRobustaStock[],
    signal: DailySignal | null,
    latestPrice: RawMarketPrice | null,
  ): InsightFactorCard {
    const latestStock = stocks[0] ?? null;
    const spread = signal?.spread != null ? signal.spread.toNumber() : null;
    const basis = signal?.basis != null ? signal.basis.toNumber() : null;
    const regime = signal?.regime || 'NORMAL';

    // Compute 7d / 30d change on ICE Robusta stocks if sufficient history exists
    let change7dLots: number | null = null;
    let change30dLots: number | null = null;

    if (latestStock && stocks.length > 1) {
      const latestTs = latestStock.report_date.getTime();
      const stock7d = this.findNearestPrior(stocks, latestTs - 7 * 86400000, 5 * 86400000);
      const stock30d = this.findNearestPrior(stocks, latestTs - 30 * 86400000, 5 * 86400000);
      if (stock7d) change7dLots = latestStock.certified_lots - stock7d.certified_lots;
      if (stock30d) change30dLots = latestStock.certified_lots - stock30d.certified_lots;
    }

    const isStrongBackwardation = regime === 'BACKWARDATION_STRONG' || (spread !== null && spread > 200);
    const isMildBackwardation = regime === 'BACKWARDATION_MILD' || (spread !== null && spread > 0 && spread <= 200);
    const isContango = regime.startsWith('CONTANGO') || (spread !== null && spread < 0);

    let trend: InsightTrend = 'NEUTRAL';
    let badgeLabel = 'CUNG – CẦU CÂN BẰNG';
    let impactOnCoffee =
      'Cấu trúc kỳ hạn và lượng tồn kho sàn ICE đang ở vùng cân bằng, giá chịu chi phối chính bởi tiến độ thu hái thực tế.';

    if (
      isStrongBackwardation ||
      (change7dLots !== null && change7dLots <= -150)
    ) {
      trend = 'UP';
      badgeLabel = isStrongBackwardation
        ? 'CUNG THẮT CHẶT (BACKWARDATION)'
        : `TỒN KHO GIẢM (${change7dLots} LÔ / 7N)`;
      impactOnCoffee =
        'Hàng giao ngay khan hiếm hơn kỳ hạn xa tạo lực đỡ tích cực cho giá thu mua cà phê Robusta.';
    } else if (
      isContango ||
      (change7dLots !== null && change7dLots >= 150)
    ) {
      trend = 'DOWN';
      badgeLabel =
        change7dLots !== null && change7dLots >= 150
          ? `TỒN KHO TĂNG (+${change7dLots} LÔ / 7N)`
          : 'NGUỒN CUNG DỒI DÀO (CONTANGO)';
      impactOnCoffee =
        'Áp lực bổ sung tồn kho trên sàn và trạng thái Contango thường tạo sức ép kìm hãm đà tăng giá ngắn hạn.';
    } else if (isMildBackwardation) {
      trend = 'UP';
      badgeLabel = 'CUNG HƠI CĂNG (BACKWARDATION NHẸ)';
      impactOnCoffee =
        'Giá giao gần nhỉnh hơn kỳ hạn xa cho thấy nhu cầu giao ngay vẫn duy trì tốt.';
    }

    const parts: string[] = [];
    let metricValue = 'N/A';

    if (latestStock) {
      const tonnesRounded = Math.round(latestStock.certified_tonnes.toNumber());
      metricValue = `${latestStock.certified_lots.toLocaleString('vi-VN')} lô (${tonnesRounded.toLocaleString('vi-VN')} tấn)`;
      const staleNote = latestStock.is_stale
        ? ` (giữ số liệu ngày ${this.toIsoDate(latestStock.report_date)} do nguồn ICE tạm gián đoạn)`
        : ` (cập nhật ngày ${this.toIsoDate(latestStock.report_date)})`;

      if (change7dLots !== null) {
        const deltaStr = `${change7dLots > 0 ? '+' : ''}${change7dLots.toLocaleString('vi-VN')} lô`;
        parts.push(
          `Tồn kho Robusta chứng nhận ICE đạt ${metricValue}${staleNote}, biến động ${deltaStr} trong 7 ngày qua.`,
        );
      } else if (latestStock.dod_change_lots !== null) {
        const dodStr = `${latestStock.dod_change_lots > 0 ? '+' : ''}${latestStock.dod_change_lots} lô`;
        parts.push(
          `Tồn kho Robusta chứng nhận ICE đạt ${metricValue}${staleNote}, thay đổi ${dodStr} so với phiên liền trước (đang tiếp tục tích lũy chuỗi 7–30 ngày).`,
        );
      } else {
        parts.push(
          `Tồn kho Robusta chứng nhận ICE đạt ${metricValue}${staleNote} (dữ liệu đang tích lũy chuỗi 7–30 ngày nên xu hướng trung hạn tham chiếu thêm qua chênh lệch kỳ hạn).`,
        );
      }
    } else {
      parts.push('Chưa có bản ghi tồn kho ICE Robusta trong DB; đang đánh giá cung – cầu qua chênh lệch kỳ hạn London.');
      if (spread !== null) {
        metricValue = `Spread ${spread > 0 ? '+' : ''}${spread.toFixed(0)} $/tấn`;
      }
    }

    if (spread !== null) {
      const m1Text = latestPrice?.london_m1 ? ` (M1 $${latestPrice.london_m1.toNumber().toLocaleString('en-US')})` : '';
      const spreadDesc =
        spread > 0
          ? `giá kỳ hạn gần cao hơn kỳ hạn xa +$${spread.toFixed(0)}/tấn`
          : `giá kỳ hạn gần thấp hơn kỳ hạn xa $${spread.toFixed(0)}/tấn`;
      parts.push(
        `Chênh lệch kỳ hạn M1–M6 trên sàn London đạt ${spread > 0 ? '+' : ''}$${spread.toFixed(0)}/tấn${m1Text} (${regime}: ${spreadDesc}).`,
      );
    }

    if (basis !== null) {
      const basisDesc =
        basis >= 0
          ? 'nội địa đang cao hơn giá London quy đổi (áp lực giữ hàng bán chậm)'
          : 'nội địa đang thấp hơn giá London quy đổi (dư địa cân bằng xuất khẩu)';
      parts.push(
        `Basis nội địa – London ở mức ${basis > 0 ? '+' : ''}${Math.round(basis).toLocaleString('vi-VN')} đ/kg (${basisDesc}).`,
      );
    }

    return {
      key: 'inventory_supply',
      title: 'Tồn kho ICE & Cung – Cầu Robusta',
      trend,
      badge_label: badgeLabel,
      metric_value: metricValue,
      metric_source: latestStock
        ? `ICE Robusta Stocks (${latestStock.source_name}) + Spread M1-M6`
        : 'ICE London Spread M1-M6 & Basis',
      explanation: parts.join(' '),
      impact_on_coffee: impactOnCoffee,
      details: {
        certified_lots: latestStock?.certified_lots ?? null,
        certified_tonnes: latestStock ? latestStock.certified_tonnes.toNumber() : null,
        report_date: latestStock ? this.toIsoDate(latestStock.report_date) : null,
        is_stale: latestStock?.is_stale ?? null,
        change_7d_lots: change7dLots,
        change_30d_lots: change30dLots,
        calendar_spread: spread,
        regime,
        basis_vnd_kg: basis !== null ? Math.round(basis) : null,
      },
    };
  }

  analyzeFx(prices: RawMarketPrice[]): InsightFactorCard {
    const valid = prices
      .filter((p) => p.usd_vnd !== null)
      .map((p) => ({
        date: this.toIsoDate(p.price_date),
        val: p.usd_vnd!.toNumber(),
      }));

    if (valid.length === 0) {
      return {
        key: 'fx',
        title: 'Tỷ giá USD/VND',
        trend: 'NEUTRAL',
        badge_label: 'CHƯA CÓ DỮ LIỆU',
        metric_value: 'N/A',
        metric_source: 'Vietcombank XML',
        explanation: 'Chưa có dữ liệu tỷ giá thương mại USD/VND.',
        impact_on_coffee: 'Chưa thể đánh giá tác động tỷ giá quy đổi xuất khẩu.',
        details: {},
      };
    }

    const latest = valid[0].val;
    const ref7d = valid[Math.min(7, valid.length - 1)].val;
    const ref30d = valid[valid.length - 1].val;

    const delta7dPct = ref7d > 0 && valid.length > 1 ? ((latest - ref7d) / ref7d) * 100 : 0;
    const delta30dPct = ref30d > 0 && valid.length > 1 ? ((latest - ref30d) / ref30d) * 100 : 0;

    let trend: InsightTrend = 'NEUTRAL';
    let badgeLabel = `ỔN ĐỊNH (${this.formatSignedPct(delta7dPct)} / 7N)`;
    let impactOnCoffee =
      'Tỷ giá USD/VND biến động trong biên độ hẹp, giữ tác động trung tính lên giá cà phê quy đổi VNĐ.';

    if (delta7dPct >= 0.25) {
      trend = 'UP';
      badgeLabel = `USD TĂNG (${this.formatSignedPct(delta7dPct)} / 7N)`;
      impactOnCoffee =
        'Đồng USD mạnh lên giúp nâng giá trị tiền Việt thu về khi quy đổi hợp đồng xuất khẩu USD, hỗ trợ giá nội địa.';
    } else if (delta7dPct <= -0.25) {
      trend = 'DOWN';
      badgeLabel = `USD GIẢM (${this.formatSignedPct(delta7dPct)} / 7N)`;
      impactOnCoffee =
        'Đồng USD hạ nhiệt làm thu hẹp nhẹ phần lợi thế quy đổi VNĐ của các lô hàng xuất khẩu.';
    }

    const explanation = `Tỷ giá Vietcombank đạt ${Math.round(latest).toLocaleString(
      'vi-VN',
    )} đ/USD (${this.formatSignedPct(delta7dPct)} trong 7 ngày so với ${Math.round(
      ref7d,
    ).toLocaleString('vi-VN')} đ; ${this.formatSignedPct(delta30dPct)} trong ${
      valid.length
    } ngày).`;

    return {
      key: 'fx',
      title: 'Tỷ giá USD/VND',
      trend,
      badge_label: badgeLabel,
      metric_value: `${Math.round(latest).toLocaleString('vi-VN')} đ`,
      metric_source: 'Vietcombank XML Feed',
      explanation,
      impact_on_coffee: impactOnCoffee,
      details: {
        latest: Math.round(latest),
        delta_7d_pct: Number(delta7dPct.toFixed(3)),
        delta_30d_pct: Number(delta30dPct.toFixed(3)),
      },
    };
  }

  analyzeWeatherAndClimate(
    weatherRows: DailyWeather[],
    climateRows: MacroClimateMonthly[],
  ): InsightFactorCard {
    const daklakWeather =
      weatherRows.find((w) => w.province_code === 'DAKLAK') || weatherRows[0] || null;

    // Latest climate row for rainfall anomaly + latest non-null ONI row
    const latestClimate = climateRows[0] ?? null;
    const latestOniRow = climateRows.find((c) => c.oni_index !== null) ?? null;

    if (!daklakWeather && !latestClimate) {
      return {
        key: 'weather_climate',
        title: 'Thời tiết Tây Nguyên & Khí hậu',
        trend: 'NEUTRAL',
        badge_label: 'CHƯA CÓ DỮ LIỆU',
        metric_value: 'N/A',
        metric_source: 'Open-Meteo + NOAA ONI',
        explanation: 'Chưa có dữ liệu thời tiết hàng ngày hoặc khí hậu tháng.',
        impact_on_coffee: 'Chưa thể đánh giá rủi ro thu hái, phơi sấy và sinh trưởng.',
        details: {},
      };
    }

    const precip = daklakWeather ? daklakWeather.precipitation_mm.toNumber() : 0;
    const tempCurr = daklakWeather?.temp_current ? daklakWeather.temp_current.toNumber() : null;
    const tempMin = daklakWeather ? daklakWeather.temp_min.toNumber() : null;
    const tempMax = daklakWeather ? daklakWeather.temp_max.toNumber() : null;
    const humidity = daklakWeather?.humidity_pct ?? null;

    const rainyProvinces = weatherRows.filter((w) => w.precipitation_mm.toNumber() >= 1.5);
    const oni = latestOniRow?.oni_index ? latestOniRow.oni_index.toNumber() : null;
    const oniMonth = latestOniRow ? this.toIsoDate(latestOniRow.month_date).slice(0, 7) : null;
    const vnRainAnom = latestClimate?.vn_rain_anomaly
      ? latestClimate.vn_rain_anomaly.toNumber()
      : null;
    const brRainAnom = latestClimate?.br_rain_anomaly
      ? latestClimate.br_rain_anomaly.toNumber()
      : null;

    let trend: InsightTrend = 'NEUTRAL';
    let badgeLabel = 'NẮNG RÁO THUẬN LỢI';
    let impactOnCoffee =
      daklakWeather?.farming_impact_vi ||
      'Thời tiết Tây Nguyên ổn định cho sinh trưởng và phơi sấy.';

    if (precip >= 15 || (oni !== null && oni >= 1.5 && vnRainAnom !== null && vnRainAnom <= -50)) {
      trend = 'UP';
      badgeLabel =
        precip >= 15 ? 'CẢNH BÁO MƯA TO SÂN PHƠI' : 'EL NIÑO MẠNH / THIẾU HỤT MƯA';
      if (oni !== null && oni >= 1.5 && precip < 15) {
        impactOnCoffee =
          'Thời tiết hôm nay tại Đắk Lắk nắng ráo thuận lợi phơi sấy, nhưng bối cảnh El Niño mạnh kèm hụt mưa tích lũy có thể gây rủi ro năng suất vụ sau (hỗ trợ giá trung-dài hạn).';
      }
    } else if (precip >= 1.5 || rainyProvinces.length >= 2) {
      trend = 'NEUTRAL';
      badgeLabel = 'CÓ MƯA CẦN LƯU Ý PHƠI';
    }

    const explanationParts: string[] = [];
    let metricValue = 'N/A';

    if (daklakWeather) {
      const tLabel = tempCurr !== null ? `${tempCurr.toFixed(1)}°C` : `${tempMin?.toFixed(0)}–${tempMax?.toFixed(0)}°C`;
      metricValue = `${tLabel} • ${precip.toFixed(1)} mm`;
      const rainyNames = rainyProvinces.map((p) => `${p.province_name} (${p.precipitation_mm.toNumber().toFixed(1)} mm)`);
      const regionalNote =
        rainyNames.length > 0 && precip < 1.5
          ? ` (lưu ý mưa rải rác tại ${rainyNames.join(', ')})`
          : '';
      explanationParts.push(
        `Hôm nay tại Đắk Lắk: ${daklakWeather.condition_vi}, nhiệt độ ${tLabel} (biên ${tempMin?.toFixed(
          1,
        )}–${tempMax?.toFixed(1)}°C), lượng mưa ${precip.toFixed(1)} mm, độ ẩm ${
          humidity ?? 'N/A'
        }%${regionalNote}.`,
      );
    }

    if (latestClimate) {
      const oniText =
        oni !== null
          ? `NOAA ONI ${oni > 0 ? '+' : ''}${oni.toFixed(2)} (${
              oni >= 0.5 ? 'pha El Niño' : oni <= -0.5 ? 'pha La Niña' : 'trung tính'
            }, kỳ ${oniMonth})`
          : 'chỉ số ONI đang chờ kỳ công bố mới';
      const vnText =
        vnRainAnom !== null
          ? `dị thường mưa Đắk Lắk ${vnRainAnom > 0 ? '+' : ''}${vnRainAnom.toFixed(1)} mm`
          : '';
      const brText =
        brRainAnom !== null
          ? `Linhares Brazil ${brRainAnom > 0 ? '+' : ''}${brRainAnom.toFixed(1)} mm`
          : '';
      const climateJoin = [oniText, vnText, brText].filter(Boolean).join(', ');
      explanationParts.push(`Bối cảnh khí hậu vĩ mô: ${climateJoin}.`);
    }

    return {
      key: 'weather_climate',
      title: 'Thời tiết Tây Nguyên & Khí hậu',
      trend,
      badge_label: badgeLabel,
      metric_value: metricValue,
      metric_source: 'Open-Meteo Forecast + NOAA ONI',
      explanation: explanationParts.join(' '),
      impact_on_coffee: impactOnCoffee,
      details: {
        benchmark_province: daklakWeather?.province_code ?? null,
        temp_current: tempCurr,
        precipitation_mm: precip,
        humidity_pct: humidity,
        rainy_provinces: rainyProvinces.map((p) => p.province_code),
        oni,
        oni_month: oniMonth,
        vn_rain_anomaly: vnRainAnom,
        br_rain_anomaly: brRainAnom,
      },
    };
  }

  analyzeForecastTransparency(
    run: ForecastRunWithPredictions | null,
    latestPrice: RawMarketPrice | null,
  ): ForecastTransparencySummary {
    if (!run || !run.predictions || run.predictions.length === 0) {
      return {
        available: false,
        run_id: null,
        forecast_date: null,
        origin_price_daklak: latestPrice ? latestPrice.price_daklak.toNumber() : null,
        model_version: null,
        direction_label: 'CHƯA CÓ DỮ LIỆU',
        summary: 'Chưa có kết quả chạy mô hình dự báo 6 tháng thành công trong cơ sở dữ liệu.',
        confidence_note: 'Cần chạy forecast-queue để tạo vector dự báo 26 tuần.',
        key_drivers: [],
        milestones: [],
        metrics: null,
      };
    }

    const originPrice = latestPrice ? latestPrice.price_daklak.toNumber() : run.predictions[0].pred_p50.toNumber();
    const rawMetrics = (run.metrics || {}) as Record<string, any>;

    const normalizeMape = (val: any): number | null => {
      if (typeof val !== 'number' || !Number.isFinite(val)) return null;
      return Number(val.toFixed(2));
    };

    const metrics = {
      wf_mape_4w: normalizeMape(rawMetrics.wf_mape_4w),
      wf_mape_12w: normalizeMape(rawMetrics.wf_mape_12w),
      wf_mape_26w: normalizeMape(rawMetrics.wf_mape_26w),
      pinball_loss:
        typeof rawMetrics.pinball_loss === 'number'
          ? Number(rawMetrics.pinball_loss.toFixed(4))
          : null,
      beats_naive_baseline:
        typeof rawMetrics.beats_naive_baseline === 'boolean'
          ? rawMetrics.beats_naive_baseline
          : null,
    };

    const milestoneSpecs = [
      { week: 4, label: '1 Tháng (T+4)' },
      { week: 12, label: '3 Tháng (T+12)' },
      { week: 26, label: '6 Tháng (T+26)' },
    ];

    const milestones: ForecastMilestoneSummary[] = milestoneSpecs
      .map((spec) => {
        const pred = run.predictions.find((p) => p.horizon_week === spec.week);
        if (!pred) return null;
        const p10 = pred.pred_p10.toNumber();
        const p50 = pred.pred_p50.toNumber();
        const p90 = pred.pred_p90.toNumber();
        const deltaPct = originPrice > 0 ? ((p50 - originPrice) / originPrice) * 100 : 0;
        const bandPct = p50 > 0 ? ((p90 - p10) / p50) * 100 : 0;
        return {
          horizon_label: spec.label,
          horizon_week: spec.week,
          target_date: this.toIsoDate(pred.target_date),
          pred_p10: Math.round(p10),
          pred_p50: Math.round(p50),
          pred_p90: Math.round(p90),
          baseline_rw: pred.baseline_rw ? Math.round(pred.baseline_rw.toNumber()) : null,
          baseline_futures: pred.baseline_futures ? Math.round(pred.baseline_futures.toNumber()) : null,
          delta_vs_today_pct: Number(deltaPct.toFixed(2)),
          band_width_pct: Number(bandPct.toFixed(1)),
        };
      })
      .filter((m): m is ForecastMilestoneSummary => m !== null);

    const m1 = milestones.find((m) => m.horizon_week === 4);
    const m3 = milestones.find((m) => m.horizon_week === 12);
    const m6 = milestones.find((m) => m.horizon_week === 26);

    const delta6m = m6?.delta_vs_today_pct ?? 0;
    let directionLabel = 'ĐI NGANG / TÍCH LŨY';
    if (delta6m >= 2.0) directionLabel = 'XU HƯỚNG TĂNG';
    else if (delta6m <= -2.0) directionLabel = 'XU HƯỚNG GIẢM';

    const m1Text = m1
      ? `1 tháng đạt ${m1.pred_p50.toLocaleString('vi-VN')} đ/kg (${this.formatSignedPct(
          m1.delta_vs_today_pct,
        )})`
      : '';
    const m3Text = m3
      ? `3 tháng đạt ${m3.pred_p50.toLocaleString('vi-VN')} đ/kg (${this.formatSignedPct(
          m3.delta_vs_today_pct,
        )})`
      : '';
    const m6Text = m6
      ? `6 tháng đạt ${m6.pred_p50.toLocaleString('vi-VN')} đ/kg (${this.formatSignedPct(
          m6.delta_vs_today_pct,
        )}, biên tin cậy 80%: ${m6.pred_p10.toLocaleString('vi-VN')}–${m6.pred_p90.toLocaleString(
          'vi-VN',
        )} đ/kg)`
      : '';

    const summary = `So với giá Đắk Lắk mốc gốc ${Math.round(originPrice).toLocaleString(
      'vi-VN',
    )} đ/kg, kịch bản trung vị (P50) dự kiến ${[m1Text, m3Text, m6Text]
      .filter(Boolean)
      .join('; ')}.`;

    const mapeParts = [
      metrics.wf_mape_4w !== null ? `4 tuần: ${metrics.wf_mape_4w.toFixed(2)}%` : null,
      metrics.wf_mape_12w !== null ? `12 tuần: ${metrics.wf_mape_12w.toFixed(2)}%` : null,
      metrics.wf_mape_26w !== null ? `26 tuần: ${metrics.wf_mape_26w.toFixed(2)}%` : null,
    ]
      .filter(Boolean)
      .join(', ');

    const naiveStatus =
      metrics.beats_naive_baseline === true
        ? 'Mô hình VƯỢT QUA chuẩn đối sánh Naive Random Walk ngoài mẫu.'
        : 'Lưu ý minh bạch: ở lần kiểm định ngoài mẫu gần nhất trên tập Walk-Forward 12 mốc, sai số trung vị chưa vượt trội hoàn toàn so với Naive Random Walk — cần theo dõi kèm dải rủi ro P10–P90.';

    const confidenceNote = `Kiểm toán Walk-Forward ngoài mẫu — MAPE (${mapeParts || 'N/A'}), Pinball Loss: ${
      metrics.pinball_loss ?? 'N/A'
    }. ${naiveStatus}`;

    const keyDrivers: string[] = [
      'P50 là kịch bản trung vị xác suất 50%; dải P10–P90 phản ánh 80% vùng dao động rủi ro thực tế.',
    ];
    if (m6?.baseline_futures !== null && m6?.baseline_futures !== undefined) {
      const futuresDiff = m6.pred_p50 - m6.baseline_futures;
      keyDrivers.push(
        `So với đường quy đổi kỳ hạn Futures (${m6.baseline_futures.toLocaleString(
          'vi-VN',
        )} đ/kg ở tuần 26), dự báo P50 đang ${futuresDiff >= 0 ? 'cao hơn' : 'thấp hơn'} ${Math.abs(
          futuresDiff,
        ).toLocaleString('vi-VN')} đ/kg.`,
      );
    }
    if (m6) {
      keyDrivers.push(
        `Độ rộng dải phân vị ở tuần 26 là ${m6.band_width_pct.toFixed(
          1,
        )}% — phản ánh độ bất định tăng dần khi chân trời kéo dài tới 6 tháng.`,
      );
    }

    return {
      available: true,
      run_id: run.run_id,
      forecast_date: this.toIsoDate(run.forecast_date),
      origin_price_daklak: Math.round(originPrice),
      model_version: run.model_version,
      direction_label: directionLabel,
      summary,
      confidence_note: confidenceNote,
      key_drivers: keyDrivers,
      milestones,
      metrics,
    };
  }

  private computeOverallStance(
    inventory: InsightFactorCard,
    fx: InsightFactorCard,
    oil: InsightFactorCard,
    forecast: ForecastTransparencySummary,
  ): MarketStance {
    let score = 0;
    if (inventory.trend === 'UP') score += 2;
    else if (inventory.trend === 'DOWN') score -= 2;

    if (fx.trend === 'UP') score += 1;
    else if (fx.trend === 'DOWN') score -= 1;

    if (oil.trend === 'UP') score += 1;

    const m6 = forecast.milestones.find((m) => m.horizon_week === 26);
    if (m6) {
      if (m6.delta_vs_today_pct >= 2) score += 1;
      else if (m6.delta_vs_today_pct <= -2) score -= 1;
    }

    if (score >= 2) return 'TÍCH CỰC';
    if (score <= -2) return 'THẬN TRỌNG';
    return 'TRUNG LẬP';
  }

  private buildExecutiveSummary(params: {
    latestPrice: RawMarketPrice | null;
    latestSignal: DailySignal | null;
    inventoryCard: InsightFactorCard;
    oilCard: InsightFactorCard;
    weatherCard: InsightFactorCard;
    forecastTransparency: ForecastTransparencySummary;
  }): string {
    const {
      latestPrice,
      latestSignal,
      inventoryCard,
      oilCard,
      weatherCard,
      forecastTransparency,
    } = params;

    const daklakText = latestPrice
      ? `Giá cà phê Đắk Lắk hiện ở mức ${Math.round(latestPrice.price_daklak.toNumber()).toLocaleString('vi-VN')} đ/kg`
      : 'Giá cà phê nội địa đang chờ đồng bộ phiên mới';

    const supplyText = `Tồn kho & cung cầu (${inventoryCard.metric_value}) mang tín hiệu ${inventoryCard.badge_label.toLowerCase()}`;
    const macroText = `dầu Brent ${oilCard.metric_value} (${oilCard.badge_label})`;
    const weatherText = `thời tiết Tây Nguyên ${weatherCard.metric_value} (${weatherCard.badge_label.toLowerCase()})`;

    const m6 = forecastTransparency.milestones.find((m) => m.horizon_week === 26);
    const forecastText = m6
      ? ` Dự báo trung vị 6 tháng đạt ${m6.pred_p50.toLocaleString('vi-VN')} đ/kg (${this.formatSignedPct(
          m6.delta_vs_today_pct,
        )}, P10–P90: ${m6.pred_p10.toLocaleString('vi-VN')}–${m6.pred_p90.toLocaleString('vi-VN')} đ).`
      : '';

    const anomalyText = latestSignal?.is_anomaly
      ? ' Cảnh báo: phiên gần nhất ghi nhận biến động thống kê bất thường (|Z| > 2.5).'
      : '';

    return `${daklakText}. ${supplyText}; ${macroText}; ${weatherText}.${forecastText}${anomalyText}`;
  }

  private findNearestPrior(
    stocks: IceRobustaStock[],
    targetMs: number,
    maxDiffMs: number,
  ): IceRobustaStock | null {
    let best: IceRobustaStock | null = null;
    let bestDiff = Infinity;
    for (let i = 1; i < stocks.length; i++) {
      const diff = Math.abs(stocks[i].report_date.getTime() - targetMs);
      if (diff < bestDiff) {
        best = stocks[i];
        bestDiff = diff;
      }
    }
    return best && bestDiff <= maxDiffMs ? best : null;
  }

  private formatSignedPct(val: number): string {
    return `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;
  }

  private toIsoDate(d: Date | string): string {
    if (d instanceof Date) return d.toISOString().split('T')[0];
    return String(d).split('T')[0];
  }

  private todayIsoVn(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }
}
