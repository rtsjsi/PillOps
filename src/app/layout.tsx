import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import BottomNav from '@/components/ui/BottomNav';
import Header from '@/components/ui/Header';
import { ThemeProvider } from '@/components/ui/ThemeProvider';

// Load Google Fonts – Inter for UI, Space Grotesk for headings
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' });

export const metadata: Metadata = {
  title: 'PillOps – Smart Pharmacy Operations',
  description: 'A premium demo of pharmacy store operations with stunning UI/UX.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body>
        <ThemeProvider>
          <Header />
          <main className="main-content">
            {children}
          </main>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}

