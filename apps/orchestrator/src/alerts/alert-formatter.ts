export interface MarketBriefingData {
  date: string;
  daklakPrice: number;
  dodChangePct: number;
  londonM1: number | null;
  spreadM1M6: number | null;
  usdVndRate: number | null;
  basisVndKg: number;
  regime: string;
  volatility30d: number | null;
  forecastSummary?: string;
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
  /**
   * Formats the Daily Morning Briefing message in Telegram HTML format.
   */
  static formatMorningBriefing(data: MarketBriefingData): string {
    const dodSign = data.dodChangePct > 0 ? '+' : '';
    const dodFormatted = `${dodSign}${(data.dodChangePct * 100).toFixed(2)}%`;
    const dodIcon = data.dodChangePct > 0 ? '🟢' : data.dodChangePct < 0 ? '🔴' : '⚪';

    const londonStr = data.londonM1 !== null ? `$${data.londonM1.toLocaleString('en-US')}` : 'N/A';
    const spreadStr = data.spreadM1M6 !== null ? `${data.spreadM1M6 > 0 ? '+' : ''}${data.spreadM1M6} USD/tấn` : 'N/A';
    const fxStr = data.usdVndRate !== null ? `${data.usdVndRate.toLocaleString('vi-VN')} đ` : 'N/A';
    const basisSign = data.basisVndKg > 0 ? '+' : '';
    const basisFormatted = `${basisSign}${data.basisVndKg.toLocaleString('vi-VN')} đ/kg`;

    const volFormatted = data.volatility30d !== null ? `${(data.volatility30d * 100).toFixed(2)}%/ngày` : 'N/A';
    const forecastStr = data.forecastSummary || '<i>Dự báo 6T: Đang chuẩn bị dữ liệu (Phase 3)</i>';

    return [
      `☕ <b>BẢN TIN THỊ TRƯỜNG CÀ PHÊ SÁNG — ${data.date}</b>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📍 <b>Đắk Lắk (Benchmark):</b> <code>${data.daklakPrice.toLocaleString('vi-VN')} đ/kg</code> (${dodIcon} ${dodFormatted})`,
      `🌐 <b>ICE London Robusta:</b> M1: <code>${londonStr}</code> | Spread (M1-M6): <code>${spreadStr}</code>`,
      `💵 <b>Tỷ giá Vietcombank:</b> <code>${fxStr}</code>`,
      `⚖️ <b>Basis (Nội địa - London):</b> <code>${basisFormatted}</code>`,
      `📊 <b>Trạng thái Thị trường:</b> <b>${data.regime}</b> (Biến động 30N: <code>${volFormatted}</code>)`,
      `🔮 <b>Dự báo Xu hướng:</b> ${forecastStr}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Hệ thống Coffee Tracker tự động cập nhật</i>`,
    ].join('\n');
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
      data.notes ? `📝 <b>Ghi chú:</b> <i>${data.notes}</i>` : '',
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Khuyến nghị: Rà soát ngay các hợp đồng giao dịch vật chất & kỳ hạn!</i>`,
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
      `⚙️ <b>Hàng đợi:</b> <code>${data.queueName}</code>`,
      `📌 <b>Tác vụ:</b> <code>${data.jobName}</code> (ID: ${data.jobId})`,
      `🔄 <b>Lượt thử:</b> <code>${data.attempts}/${data.maxAttempts}</code> (Đã dùng hết số lần retry)`,
      `⚠️ <b>Chi tiết sự cố:</b>`,
      `<pre>${data.errorMessage.substring(0, 400)}</pre>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━`,
      `<i>Vui lòng kiểm tra log NestJS orchestrator hoặc kết nối mạng!</i>`,
    ].join('\n');
  }
}
