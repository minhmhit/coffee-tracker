import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Coffee Tracker — Giám sát & Dự báo Giá Cà phê Tây Nguyên 6 Tháng',
  description:
    'Hệ thống theo dõi thị trường cà phê Tây Nguyên thời gian thực và dự báo phân vị 6 tháng sử dụng mô hình kết hợp VECM và LightGBM Quantile.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-stone-50 text-stone-900 min-h-screen antialiased selection:bg-amber-200/70 selection:text-amber-950">
        {children}
      </body>
    </html>
  );
}
