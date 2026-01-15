'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { ErrorFallback } from './ErrorFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 에러 바운더리 컴포넌트
 * React 컴포넌트 트리에서 발생하는 에러를 catch하고 폴백 UI 표시
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // 선택적 에러 콜백 (외부 에러 트래킹 서비스용)
    this.props.onError?.(error, errorInfo);
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // 커스텀 폴백이 있으면 사용
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 기본 ErrorFallback 사용
      return (
        <ErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}
