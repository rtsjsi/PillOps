'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { 
  Search, 
  PlusCircle, 
  AlertTriangle, 
  FileText, 
  TrendingDown, 
  LayoutDashboard,
  ShoppingCart,
  Package
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="container flex items-start justify-center pt-[15vh]">
        <Command 
          className="w-full max-w-[640px] bg-card rounded-[2rem] shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
        >
          <div className="flex items-center border-b border-border px-6">
            <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            <Command.Input 
              placeholder="What do you want to do? (type 'Search', 'Add', 'Expiring'...)" 
              className="flex h-16 w-full bg-transparent py-4 text-lg outline-none placeholder:text-muted-foreground px-4"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-4 scrollbar-hide">
            <Command.Empty className="py-12 text-center text-muted-foreground font-medium">
              No results found.
            </Command.Empty>

            <Command.Group heading="Main Actions" className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-4 mb-2">
              <CommandItem icon={<LayoutDashboard size={18} />} onSelect={() => runCommand(() => router.push('/dashboard'))}>
                Go to Dashboard
              </CommandItem>
              <CommandItem icon={<ShoppingCart size={18} />} onSelect={() => runCommand(() => router.push('/pos'))}>
                New Sale / POS
              </CommandItem>
              <CommandItem icon={<Package size={18} />} onSelect={() => runCommand(() => router.push('/inventory'))}>
                View Inventory
              </CommandItem>
            </Command.Group>

            <Command.Group heading="Inventory Management" className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-4 mb-2 mt-6">
              <CommandItem icon={<Search size={18} />} onSelect={() => runCommand(() => router.push('/inventory'))}>
                Search medication by name
              </CommandItem>
              <CommandItem icon={<PlusCircle size={18} />} onSelect={() => runCommand(() => router.push('/purchases/scan'))}>
                Add new stock item (AI Scan)
              </CommandItem>
              <CommandItem icon={<AlertTriangle size={18} />} onSelect={() => runCommand(() => router.push('/expiry'))}>
                View expiring soon
              </CommandItem>
              <CommandItem icon={<TrendingDown size={18} />} onSelect={() => runCommand(() => router.push('/inventory'))}>
                View low stock alerts
              </CommandItem>
              <CommandItem icon={<FileText size={18} />} onSelect={() => runCommand(() => router.push('/admin'))}>
                Generate reorder report
              </CommandItem>
            </Command.Group>
          </Command.List>

          <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
             <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                <span className="flex items-center gap-1"><kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">ESC</kbd> to close</span>
                <span className="flex items-center gap-1"><kbd className="bg-muted px-1.5 py-0.5 rounded border border-border">↵</kbd> to select</span>
             </div>
             <div className="text-[10px] font-bold text-primary">PillOps v1.0</div>
          </div>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({ children, icon, onSelect }: { children: React.ReactNode, icon: React.ReactNode, onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer aria-selected:bg-primary aria-selected:text-white transition-colors group"
    >
      <div className="p-2 rounded-lg bg-muted group-aria-selected:bg-white/20 transition-colors">
        {icon}
      </div>
      <span className="font-bold">{children}</span>
    </Command.Item>
  );
}
