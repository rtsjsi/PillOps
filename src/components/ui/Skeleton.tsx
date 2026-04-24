'use client';

import { motion } from 'framer-motion';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = '20px', borderRadius = '8px', className }: SkeletonProps) {
  return (
    <motion.div
      className={`skeleton-box ${className || ''}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--color-bg-glass)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
      animate={{
        opacity: [0.4, 0.7, 0.4],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-card" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Skeleton width="40%" height="24px" />
      <Skeleton width="90%" height="16px" />
      <Skeleton width="70%" height="16px" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <Skeleton width="40px" height="40px" borderRadius="10px" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <Skeleton width="60%" height="16px" />
        <Skeleton width="30%" height="12px" />
      </div>
      <Skeleton width="80px" height="20px" />
    </div>
  );
}

