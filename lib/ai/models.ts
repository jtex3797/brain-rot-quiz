import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import type { AIModel } from '@/types';

/**
 * AI 모델 멀티 폴백 전략
 * Priority 순서대로 시도
 *
 * 1. Gemini 2.0 Flash - 무료 한도 높음, 빠른 응답
 * 2. GPT-4o mini - 저비용, 안정적
 * 3. Claude 3.5 Haiku - 최종 폴백
 */
export const AI_MODELS: AIModel[] = [
  {
    name: 'gemini-2.0-flash-exp',
    provider: google('gemini-2.0-flash-exp'),
    priority: 1,
  },
  {
    name: 'gpt-4o-mini',
    provider: openai('gpt-4o-mini'),
    priority: 2,
  },
  {
    name: 'claude-3-5-haiku-20241022',
    provider: anthropic('claude-3-5-haiku-20241022'),
    priority: 3,
  },
];

/**
 * Priority 순서로 정렬된 모델 목록 반환
 */
export function getModelsByPriority(): AIModel[] {
  return [...AI_MODELS].sort((a, b) => a.priority - b.priority);
}

/**
 * 모델명으로 모델 찾기
 */
export function getModelByName(name: string): AIModel | undefined {
  return AI_MODELS.find((m) => m.name === name);
}
