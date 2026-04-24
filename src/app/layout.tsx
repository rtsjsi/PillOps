import './globals.css';
import type { Metadata } from 'next';
import { Inter, Geist_Mono, Space_Grotesk } from 'next/font/google';
import BottomNav from '@/components/ui/bottomNav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { ThemeProvider } from '@/components/ui/themeProvider';
import { cn } from "@/lib/utils";
import { CommandPalette } from '@/components/command-palette';
import { AIAssistant } from '@/components/ai-assistant';
import { Toaster } from "@/components/ui/sonner";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(inter.variable, geistMono.variable, spaceGrotesk.variable, "font-sans")} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-primary/10 overflow-x-hidden">
        <ThemeProvider>
          <CommandPalette />
          <AIAssistant />
          <div className="flex h-screen overflow-hidden">
            {/* Desktop Sidebar */}
            <Sidebar />
            
            <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
              {/* Top Bar */}
              <TopBar />
              
              <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 lg:p-8 scroll-smooth pb-32 lg:pb-8">
                <div className="max-w-7xl mx-auto w-full">
                  {children}
                </div>
              </main>
            </div>
          </div>
          
          {/* Mobile Navigation */}
          <BottomNav />
          
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
