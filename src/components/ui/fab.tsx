'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface FABProps {
    onClick?: () => void;
    href?: string;
    icon?: React.ReactNode;
    label?: string;
    className?: string;
}

export function FAB({ onClick, href, icon, label, className }: FABProps) {
    const router = useRouter();

    const handleClick = () => {
        if (onClick) onClick();
        else if (href) router.push(href);
    };

    return (
        <div className={cn("fixed bottom-6 right-6 z-[60] md:hidden animate-in slide-in-from-bottom-10 duration-500", className)}>
            <Button 
                onClick={handleClick}
                size="lg"
                className="h-16 w-16 rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center p-0"
            >
                {icon || <Plus size={32} />}
            </Button>
            {label && (
                <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-white/10">
                    {label}
                </div>
            )}
        </div>
    );
}
