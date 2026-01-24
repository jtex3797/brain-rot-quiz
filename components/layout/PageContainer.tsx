'use client';

import { ReactNode } from 'react';
import { CONTAINER_WIDTH, SPACING, type ContainerWidth } from '@/lib/constants/layout';

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: ContainerWidth;
  className?: string;
}

export function PageContainer({
  children,
  maxWidth = 'DEFAULT',
  className = '',
}: PageContainerProps) {
  return (
    <div
      className={`container mx-auto ${SPACING.CONTAINER_X} ${CONTAINER_WIDTH[maxWidth]} ${className}`}
    >
      {children}
    </div>
  );
}
