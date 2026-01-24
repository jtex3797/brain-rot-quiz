/**
 * 퀴즈 생성 파이프라인 로깅 유틸리티
 * 처리 단계별 시간 측정 및 상세 정보 출력
 */

// =====================================================
// Types
// =====================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogModule = 'API' | 'NLP' | 'AI' | 'Cache' | 'Pool' | 'Transform' | 'Supabase';

interface LogEntry {
  timestamp: Date;
  module: LogModule;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

interface PipelineStats {
  startTime: number;
  steps: {
    name: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
  }[];
}

// =====================================================
// 환경 설정
// =====================================================

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// =====================================================
// 로거 클래스
// =====================================================

class QuizLogger {
  private entries: LogEntry[] = [];
  private pipelineStats: PipelineStats | null = null;
  private currentStep: string | null = null;
  private stepStartTime: number | null = null;

  /**
   * 파이프라인 시작
   */
  startPipeline(requestId?: string): void {
    this.entries = [];
    this.pipelineStats = {
      startTime: Date.now(),
      steps: [],
    };
    this.log('info', 'API', '═══════════════════════════════════════════════════');
    this.log('info', 'API', `🚀 퀴즈 생성 파이프라인 시작 ${requestId ? `[${requestId}]` : ''}`);
  }

  /**
   * 처리 단계 시작
   */
  startStep(name: string): void {
    if (this.currentStep && this.stepStartTime) {
      this.endStep();
    }

    this.currentStep = name;
    this.stepStartTime = Date.now();

    if (this.pipelineStats) {
      this.pipelineStats.steps.push({
        name,
        startTime: this.stepStartTime,
      });
    }

    this.log('info', 'API', `▶ ${name} 시작...`);
  }

  /**
   * 현재 단계 종료
   */
  endStep(extraData?: Record<string, unknown>): number {
    if (!this.currentStep || !this.stepStartTime) return 0;

    const duration = Date.now() - this.stepStartTime;

    if (this.pipelineStats) {
      const step = this.pipelineStats.steps.find(
        (s) => s.name === this.currentStep
      );
      if (step) {
        step.endTime = Date.now();
        step.durationMs = duration;
      }
    }

    const dataStr = extraData
      ? ` | ${Object.entries(extraData)
          .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
          .join(', ')}`
      : '';

    this.log('info', 'API', `✓ ${this.currentStep} 완료 (${duration}ms)${dataStr}`);

    this.currentStep = null;
    this.stepStartTime = null;

    return duration;
  }

  /**
   * 파이프라인 종료 및 요약 출력
   */
  endPipeline(success: boolean, result?: Record<string, unknown>): void {
    if (!this.pipelineStats) return;

    const totalDuration = Date.now() - this.pipelineStats.startTime;

    this.log('info', 'API', '───────────────────────────────────────────────────');
    this.log('info', 'API', `📊 파이프라인 요약 (총 ${totalDuration}ms)`);

    // 각 단계별 시간
    for (const step of this.pipelineStats.steps) {
      if (step.durationMs !== undefined) {
        const percentage = Math.round((step.durationMs / totalDuration) * 100);
        const bar = '█'.repeat(Math.max(1, Math.round(percentage / 5)));
        this.log('info', 'API', `  ${bar} ${step.name}: ${step.durationMs}ms (${percentage}%)`);
      }
    }

    if (result) {
      this.log('info', 'API', `📋 결과: ${JSON.stringify(result, null, 2)}`);
    }

    this.log(
      success ? 'info' : 'error',
      'API',
      `${success ? '✅ 성공' : '❌ 실패'} | 총 소요시간: ${totalDuration}ms`
    );
    this.log('info', 'API', '═══════════════════════════════════════════════════');

    this.pipelineStats = null;
  }

  /**
   * 일반 로그
   */
  log(
    level: LogLevel,
    module: LogModule,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[LOG_LEVEL]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      module,
      level,
      message,
      data,
    };

    this.entries.push(entry);
    this.printLog(entry);
  }

  /**
   * 디버그 로그
   */
  debug(module: LogModule, message: string, data?: Record<string, unknown>): void {
    this.log('debug', module, message, data);
  }

  /**
   * 정보 로그
   */
  info(module: LogModule, message: string, data?: Record<string, unknown>): void {
    this.log('info', module, message, data);
  }

  /**
   * 경고 로그
   */
  warn(module: LogModule, message: string, data?: Record<string, unknown>): void {
    this.log('warn', module, message, data);
  }

  /**
   * 에러 로그
   */
  error(module: LogModule, message: string, data?: Record<string, unknown>): void {
    this.log('error', module, message, data);
  }

  /**
   * 텍스트 분석 정보 로그
   */
  logTextAnalysis(data: {
    originalLength: number;
    sentenceCount: number;
    processedLength?: number;
    language: string;
    extractionRatio?: number;
  }): void {
    this.info('NLP', '📝 텍스트 분석 결과', {
      '원본 길이': `${data.originalLength}자`,
      '문장 수': data.sentenceCount,
      '처리 후 길이': data.processedLength ? `${data.processedLength}자` : 'N/A',
      '언어': data.language,
      '압축률': data.extractionRatio
        ? `${Math.round((1 - data.extractionRatio) * 100)}% 감소`
        : 'N/A',
    });
  }

  /**
   * AI 호출 정보 로그
   */
  logAICall(data: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    durationMs: number;
  }): void {
    this.info('AI', '🤖 AI 호출 완료', {
      '모델': data.model,
      '입력 토큰': data.inputTokens ?? 'N/A',
      '출력 토큰': data.outputTokens ?? 'N/A',
      '총 토큰': data.totalTokens ?? 'N/A',
      '소요시간': `${data.durationMs}ms`,
    });
  }

  /**
   * 캐시 상태 로그
   */
  logCache(hit: boolean, hash?: string): void {
    if (hit) {
      this.info('Cache', `💾 캐시 HIT ${hash ? `[${hash.slice(0, 8)}...]` : ''}`);
    } else {
      this.debug('Cache', `💾 캐시 MISS ${hash ? `[${hash.slice(0, 8)}...]` : ''}`);
    }
  }

  /**
   * 콘솔 출력
   */
  private printLog(entry: LogEntry): void {
    const levelIcons: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };

    const moduleColors: Record<LogModule, string> = {
      API: '\x1b[36m',    // cyan
      NLP: '\x1b[33m',    // yellow
      AI: '\x1b[35m',     // magenta
      Cache: '\x1b[32m',  // green
      Pool: '\x1b[34m',   // blue
      Transform: '\x1b[90m', // gray
      Supabase: '\x1b[31m',  // red (DB 에러 눈에 띄게)
    };

    const reset = '\x1b[0m';
    const color = moduleColors[entry.module] || reset;

    const timestamp = entry.timestamp.toISOString().split('T')[1].split('.')[0];
    const prefix = `[${timestamp}] ${levelIcons[entry.level]} ${color}[${entry.module}]${reset}`;

    if (entry.data && Object.keys(entry.data).length > 0) {
      console.log(`${prefix} ${entry.message}`);
      for (const [key, value] of Object.entries(entry.data)) {
        console.log(`    └─ ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    } else {
      console.log(`${prefix} ${entry.message}`);
    }
  }

  /**
   * 모든 로그 엔트리 반환
   */
  getEntries(): LogEntry[] {
    return [...this.entries];
  }
}

// 싱글톤 인스턴스
export const logger = new QuizLogger();

// 편의 함수
export const startPipeline = (requestId?: string) => logger.startPipeline(requestId);
export const startStep = (name: string) => logger.startStep(name);
export const endStep = (data?: Record<string, unknown>) => logger.endStep(data);
export const endPipeline = (success: boolean, result?: Record<string, unknown>) =>
  logger.endPipeline(success, result);
