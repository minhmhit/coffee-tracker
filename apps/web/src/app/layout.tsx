import type { Metadata } from 'next';
import { Newsreader, Inter, JetBrains_Mono } from 'next/font/google';
import { getSiteUrl } from '../lib/site-url';
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

const siteUrl = getSiteUrl();
const pageTitle = 'Coffee Tracker — Giá Cà phê Hôm nay Tây Nguyên & Dự báo 6 Tháng';
const pageDescription =
  'Cập nhật giá cà phê hôm nay tại Tây Nguyên (giá cà phê Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông), giá London Robusta, tỷ giá USD/VND, thời tiết phơi sấy và dự báo giá cà phê 6 tháng minh bạch.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: pageTitle,
    template: '%s | Coffee Tracker',
  },
  description: pageDescription,
  keywords: [
    'giá cà phê hôm nay',
    'giá cà phê Đắk Lắk',
    'giá cà phê Tây Nguyên',
    'dự báo giá cà phê',
    'giá cà phê Lâm Đồng',
    'giá cà phê Gia Lai',
    'giá cà phê Đắk Nông',
    'giá cà phê trực tuyến London Robusta',
  ],
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: '/',
    siteName: 'Coffee Tracker — Giá Cà phê Tây Nguyên',
    title: pageTitle,
    description: pageDescription,
  },
  twitter: {
    card: 'summary_large_image',
    title: pageTitle,
    description: pageDescription,
  },
};

function buildStructuredData(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Coffee Tracker — Giá Cà phê Tây Nguyên',
        url: `${baseUrl}/`,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web',
        inLanguage: 'vi',
        description: pageDescription,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'VND',
        },
      },
      {
        '@type': 'Dataset',
        name: 'Dữ liệu Giá Cà phê Tây Nguyên, Thời tiết Nông vụ & Dự báo 6 Tháng',
        description:
          'Chuỗi dữ liệu hằng ngày về giá cà phê nhân xô tại Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông, giá kỳ hạn ICE London Robusta, tồn kho chứng nhận ICE, thời tiết Tây Nguyên và ước tính xu hướng 26 tuần.',
        url: `${baseUrl}/`,
        inLanguage: 'vi',
        keywords: [
          'giá cà phê hôm nay',
          'giá cà phê Đắk Lắk',
          'giá cà phê Tây Nguyên',
          'dự báo giá cà phê',
        ],
        spatialCoverage: {
          '@type': 'Place',
          name: 'Tây Nguyên, Việt Nam (Đắk Lắk, Lâm Đồng, Gia Lai, Đắk Nông)',
        },
        temporalCoverage: '2018-01-01/..',
      },
    ],
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = buildStructuredData(siteUrl);

  return (
    <html
      lang="vi"
      className={`${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans bg-[#FDFBF7] text-[#18181B] min-h-screen antialiased selection:bg-[#DCFCE7] selection:text-[#14532D]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
