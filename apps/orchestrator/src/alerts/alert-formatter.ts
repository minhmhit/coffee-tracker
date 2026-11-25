export interface MarketBriefingData {
  date: string;
  daklakPrice: number;
  dodChangePct: number;
  provinces?: {
    lamdong?: number;
    gialai?: number;
    daknong?: number;
  };
  londonM1: number | null;
  spreadM1M6: number | null;
  usdVndRate: number | null;
  basisVndKg: number;
  regime: string;
  volatility30d: number | null;
  weather?: {
    date: string;
    provinceName: string;
    tempCurrent: number | null;
    tempMin: number;
    tempMax: number;
    precipitationMm: number;
    conditionVi: string;
    farmingImpactVi: string;
  } | null;
  insights?: {
    stance?: string;
    oilLine?: string;
    supplyLine?: string;
    fxLine?: string;
  } | null;
  forecastSummary?: string;
  forecastConfidenceNote?: string;
}

export interface AnomalyAlertData {
  signalDate: string;
  daklakPrice?: number;
  dodChangePct?: number;
  zScore: string | number;
  basis: string | number;
  spread: string | number | null;
  regime: string;
  notes?: string;
}

export interface SystemErrorData {
  queueName: string;
  jobId: string;
  jobName: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string;
}

export class AlertFormatter {
  static escapeHtml(raw: string): string {
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Formats the Daily 06:00 AM Morning Briefing message in clean, mobile-scannable Telegram HTML (< 4096 chars).
   */
  static formatMorningBriefing(data: MarketBriefingData): string {
    const dodSign = data.dodChangePct > 0 ? '+' : '';
    const dodFormatted = `${dodSign}${(data.dodChangePct * 100).toFixed(2)}%`;
    const dodIcon = data.dodChangePct > 0 ? '🟢' : data.dodChangePct < 0 ? '🔴' : '⚪';

    const londonStr = data.londonM1 !== null ? `$${data.londonM1.toLocaleString('en-US')}` : 'N/A';
    const spreadStr =
      data.spreadM1M6 !== null
        ? `${data.spreadM1M6 > 0 ? '+' : ''}${data.spreadM1M6} USD/tấn`
        : 'N/A';
    const fxStr =
      data.usdVndRate !== null ? `${data.usdVndRate.toLocaleString('vi-VN')} đ` : 'N/A';
    const basisSign = data.basisVndKg > 0 ? '+' : '';
    const basisFormatted = `${basisSign}${data.basisVndKg.toLocaleString('vi-VN')} đ/kg`;
    const volFormatted =
      data.volatility30d !== null ? `${(data.volatility30d * 100).toFixed(2)}%/ngày` : 'N/A';

    const lines: string[] = [
      `☕ <b>BẢN TIN THỊ TRƯỜNG CÀ PHÊ SÁNG — ${this.escapeHtml(data.date)}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📍 <b>1. GIÁ CÀ PHÊ HÔM NAY</b>`,
      `• <b>Đắk Lắk (Benchmark):</b> <code>${data.daklakPrice.toLocaleString('vi-VN')} đ/kg</code> (${dodIcon} ${dodFormatted})`,
    ];

    if (data.provinces) {
      const provParts: string[] = [];
      if (data.provinces.lamdong) provParts.push(`Lâm Đồng: ${data.provinces.lamdong.toLocaleString('vi-VN')}`);
      if (data.provinces.gialai) provParts.push(`Gia Lai: ${data.provinces.gialai.toLocaleString('vi-VN')}`);
      if (data.provinces.daknong) provParts.push(`Đắk Nông: ${data.provinces.daknong.toLocaleString('vi-VN')}`);
      if (provParts.length > 0) {
        lines.push(`• <i>Các tỉnh khác:</i> ${provParts.join(' | ')} đ/kg`);
      }
    }

    lines.push(
      `🌐 <b>ICE London Robusta:</b> M1: <code>${londonStr}</code> | Spread (M1-M6): <code>${spreadStr}</code>`,
      `💵 <b>Tỷ giá Vietcombank:</b> <code>${fxStr}</code>`,
      `⚖️ <b>Basis (Nội địa - London):</b> <code>${basisFormatted}</code>`,
      `📊 <b>Trạng thái Thị trường:</b> <b>${this.escapeHtml(data.regime)}</b> (Biến động 30N: <code>${volFormatted}</code>)`,
    );

    if (data.weather) {
      const w = data.weather;
      const tempText =
        w.tempCurrent !== null
          ? `${w.tempCurrent.toFixed(1)}°C (biên ${w.tempMin.toFixed(0)}–${w.tempMax.toFixed(0)}°C)`
          : `${w.tempMin.toFixed(0)}–${w.tempMax.toFixed(0)}°C`;
      lines.push(
        ``,
        `🌤 <b>2. THỜI TIẾT TÂY NGUYÊN HÔM NAY (${this.escapeHtml(w.provinceName)})</b>`,
        `• ${this.escapeHtml(w.conditionVi)} | Nhiệt độ: <code>${tempText}</code> | Mưa: <code>${w.precipitationMm.toFixed(1)} mm</code>`,
        `• <i>Nông vụ:</i> ${this.escapeHtml(w.farmingImpactVi)}`,
      );
    }

    if (data.insights && (data.insights.oilLine || data.insights.supplyLine || data.insights.fxLine)) {
      const stanceBadge = data.insights.stance ? ` (${this.escapeHtml(data.insights.stance)})` : '';
      lines.push(``, `🧠 <b>3. NHẬN ĐỊNH NHANH THỊ TRƯỜNG${stanceBadge}</b>`);
      if (data.insights.supplyLine) {
        lines.push(`• <b>Tồn kho &amp; Cung cầu:</b> ${this.escapeHtml(data.insights.supplyLine)}`);
      }
      if (data.insights.oilLine) {
        lines.push(`• <b>Giá dầu Brent:</b> ${this.escapeHtml(data.insights.oilLine)}`);
      }
      if (data.insights.fxLine) {
        lines.push(`• <b>Tỷ giá:</b> ${this.escapeHtml(data.insights.fxLine)}`);
      }
    }

    const forecastStr =
      data.forecastSummary || '<i>Dự báo 6T: Đang chuẩn bị dữ liệu (Phase 3)</i>';
    lines.push(``, `🔮 <b>4. DỰ BÁO GIÁ MINH BẠCH (6 THÁNG):</b> ${forecastStr}`);

    if (data.forecastConfidenceNote) {
      lines.push(`• <i>Độ tin cậy mô hình:</i> ${this.escapeHtml(data.forecastConfidenceNote)}`);
    }

    lines.push(
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Hệ thống Coffee Tracker tự động cập nhật lúc 06:00 sáng • Gửi /today để xem lại hoặc /stop để tắt</i>`,
    );

    const rendered = lines.join('\n');
    return rendered.length > 4000 ? `${rendered.slice(0, 3970)}\n<i>...(rút gọn)</i>` : rendered;
  }

  /**
   * Formats an Anomaly Alert message when |z_score| > 2.5.
   */
  static formatAnomalyAlert(data: AnomalyAlertData): string {
    const zNum = typeof data.zScore === 'string' ? parseFloat(data.zScore) : data.zScore;
    const direction = zNum > 0 ? 'TĂNG ĐỘT BIẾN' : 'GIẢM ĐỘT BIẾN';
    const zFormatted = zNum.toFixed(2);
    const spreadStr = data.spread !== null ? `${data.spread} USD/t` : 'N/A';

    return [
      `🚨 <b>CẢNH BÁO BIẾN ĐỘNG BẤT THƯỜNG — ${direction}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚠️ <b>Ngày phát hiện:</b> <code>${data.signalDate}</code>`,
      `📈 <b>Độ lệch Z-Score 30N:</b> <code>${zFormatted}</code> (|z| > 2.50)`,
      data.daklakPrice ? `💰 <b>Giá Đắk Lắk:</b> <code>${data.daklakPrice.toLocaleString('vi-VN')} đ/kg</code>` : '',
      `⚖️ <b>Basis:</b> <code>${data.basis} đ/kg</code> | <b>Spread:</b> <code>${spreadStr}</code>`,
      `📊 <b>Trạng thái:</b> <b>${data.regime}</b>`,
      data.notes ? `📝 <b>Ghi chú:</b> <i>${this.escapeHtml(data.notes)}</i>` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Khuyến nghị: Rà soát ngay các hợp đồng giao dịch vật chất &amp; kỳ hạn!</i>`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Formats a System Error Alert message when queues exhaust all retries.
   */
  static formatSystemError(data: SystemErrorData): string {
    return [
      `❌ <b>CẢNH BÁO SỰ CỐ HỆ THỐNG (SYSTEM FAILURE)</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `⚙️ <b>Hàng đợi:</b> <code>${this.escapeHtml(data.queueName)}</code>`,
      `📌 <b>Tác vụ:</b> <code>${this.escapeHtml(data.jobName)}</code> (ID: ${this.escapeHtml(data.jobId)})`,
      `🔄 <b>Lượt thử:</b> <code>${data.attempts}/${data.maxAttempts}</code> (Đã dùng hết số lần retry)`,
      `⚠️ <b>Chi tiết sự cố:</b>`,
      `<pre>${this.escapeHtml(data.errorMessage.substring(0, 400))}</pre>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Vui lòng kiểm tra log NestJS orchestrator hoặc kết nối mạng!</i>`,
    ].join('\n');
  }

  /**
   * Strips Telegram HTML tags to provide a clean plain-text preview for web UI display.
   */
  static htmlToPlainPreview(html: string): string {
    return html
      .replace(/<\/?(b|i|code|pre)>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}
