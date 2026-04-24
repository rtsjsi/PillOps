import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk, Geist } from 'next/font/google';
import BottomNav from '@/components/ui/BottomNav';
import Header from '@/components/ui/Header';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { cn } from "@/lib/utils";

// Load Google Fonts – Inter for UI, Space Grotesk for headings
const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' });

export const metadata: Metadata = {
  title: 'PillOps – Smart Pharmacy Operations',
  description: 'A premium demo of pharmacy store operations with stunning UI/UX.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

import { Toaster } from "@/components/ui/sonner";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(spaceGrotesk.variable, "font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          <Header />
          <main className="main-content">
            {children}
          </main>
          <BottomNav />
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}



