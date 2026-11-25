import type { Metadata } from 'next';
import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const newsreader = Newsreader({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
});

const inter = Inter({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Coffee Tracker — Giá Cà phê Tây Nguyên & Dự báo 6 Tháng',
  description:
    'Theo dõi giá cà phê nhân xô Tây Nguyên (Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông), thời tiết vùng trồng, nhận định thị trường và dự báo xu hướng 6 tháng.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans bg-[#FDFBF7] text-[#18181B] min-h-screen antialiased selection:bg-[#DCFCE7] selection:text-[#14532D]">
        {children}
      </body>
    </html>
  );
}
