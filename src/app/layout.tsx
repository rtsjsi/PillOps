import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono, Space_Grotesk } from 'next/font/google';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { Providers } from '@/components/providers';
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-heading' });

export const metadata: Metadata = {
  title: 'PillOps – Clinical Pharmacy Operations',
  description: 'Professional pharmacy operations platform with Clinical Clean design system.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, geistMono.variable, spaceGrotesk.variable, "font-sans")} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-primary/10 overflow-x-hidden">
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <Sidebar />
            
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
              {/* Top Bar */}
              <TopBar />
              
              <main className="flex-1 overflow-y-auto bg-muted/20 p-3 lg:p-5 scroll-smooth pb-16 lg:pb-5">
                <div className="max-w-7xl mx-auto w-full">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
