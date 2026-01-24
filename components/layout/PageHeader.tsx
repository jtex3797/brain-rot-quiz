'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  backLink?: {
    href: string;
    label: string;
  };
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  backLink,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {backLink && (
        <Link
          href={backLink.href}
          className="text-primary hover:underline mb-4 inline-block"
        >
          ← {backLink.label}
        </Link>
      )}
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-2 text-foreground/70">{description}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}
