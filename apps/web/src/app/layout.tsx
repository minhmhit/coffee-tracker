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
    <html lang="vi" className="dark">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased selection:bg-amber-500/30 selection:text-amber-200">
        {children}
      </body>
    </html>
  );
}
