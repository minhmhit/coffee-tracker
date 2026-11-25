import { ImageResponse } from 'next/og';

export const alt =
  'Coffee Tracker — Giá Cà phê Tây Nguyên Hôm nay, Thời tiết & Dự báo 6 Tháng';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#FDFBF7',
          padding: '56px 64px',
          border: '12px solid #F5F3EF',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '9999px',
                backgroundColor: '#166534',
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: '#166534',
                textTransform: 'uppercase',
              }}
            >
              COFFEE TRACKER · TÂY NGUYÊN
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              padding: '10px 22px',
              borderRadius: '9999px',
              backgroundColor: '#ECF3EF',
              border: '2px solid #86EFAC',
              color: '#166534',
              fontSize: '20px',
              fontWeight: 700,
            }}
          >
            Cập nhật hằng ngày · Bot Telegram 06:00
          </div>
        </div>

        {/* Center Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: '58px',
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#111827',
              letterSpacing: '-0.02em',
            }}
          >
            Giá Cà phê Hôm nay &amp; Dự báo Xu hướng 6 Tháng
          </div>
          <div
            style={{
              fontSize: '28px',
              lineHeight: 1.4,
              color: '#3F3F46',
            }}
          >
            Đắk Lắk · Lâm Đồng · Gia Lai · Đắk Nông · Sàn ICE London &amp; Thời tiết Phơi sấy
          </div>
        </div>

        {/* Bottom Feature Pills */}
        <div
          style={{
            display: 'flex',
            gap: '20px',
            borderTop: '2px solid #E5E7EB',
            paddingTop: '28px',
          }}
        >
          {[
            'Bảng giá 4 tỉnh Tây Nguyên',
            'Thời tiết phơi sấy Open-Meteo',
            'Tồn kho ICE & Nhận định vĩ mô',
            'Kiểm định minh bạch 26 tuần',
          ].map((label) => (
            <div
              key={label}
              style={{
                display: 'flex',
                padding: '14px 20px',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                border: '2px solid #E5E7EB',
                fontSize: '20px',
                fontWeight: 600,
                color: '#18181B',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
