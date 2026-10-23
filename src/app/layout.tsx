import type { Metadata, Viewport } from 'next';
import { Noto_Sans_SC, Syne } from 'next/font/google';
import Script from 'next/script';
import '../lib/cron';

import './globals.css';

import AuthProvider from '../components/AuthProvider';
import PwaInstallHint from '../components/PwaInstallHint';
import { SiteProvider } from '../components/SiteProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import { ToastProvider } from '../components/Toast';

const display = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

const body = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: process.env.SITE_NAME || "Rick's Nest",
  description: "Rick's Nest · 小窝里的影视聚合",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const siteName = process.env.SITE_NAME || "Rick's Nest";
  const announcement =
    process.env.ANNOUNCEMENT ||
    '本网站仅提供影视信息搜索服务，所有内容均来自第三方网站。本站不存储任何视频资源，不对任何内容的准确性、合法性、完整性负责。';

  // 将运行时配置注入到全局 window 对象，供客户端在运行时读取
  const runtimeConfig = {
    STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage',
    ENABLE_REGISTER: process.env.NEXT_PUBLIC_ENABLE_REGISTER === 'true',
  };

  return (
    <html
      lang='zh-CN'
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <head>
        {/* 将配置序列化后直接写入脚本，浏览器端可通过 window.RUNTIME_CONFIG 获取 */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.RUNTIME_CONFIG = ${JSON.stringify(runtimeConfig)};`,
          }}
        />
      </head>
      <body className='font-sans min-h-screen text-slate-900 dark:text-slate-100 antialiased selection:bg-teal-500/30'>
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <SiteProvider siteName={siteName} announcement={announcement}>
            <ToastProvider>
              <AuthProvider>
                {children}
                <PwaInstallHint />
              </AuthProvider>
            </ToastProvider>
          </SiteProvider>
        </ThemeProvider>
        {/* Couple Nest 一起看：与「我们的小窝」App 同步播停/进度 */}
        <Script src='/couple-nest-sync.js' strategy='afterInteractive' />
      </body>
    </html>
  );
}
