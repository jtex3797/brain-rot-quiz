import type { Quiz } from '@/types';
import { STORAGE_KEY_PREFIX, ERROR_MESSAGES } from '@/lib/constants';

/**
 * 퀴즈를 로컬 스토리지에 저장
 *
 * @param quiz 저장할 퀴즈 객체
 * @returns 생성된 퀴즈 ID
 */
export function saveQuizToLocal(quiz: Quiz): string {
  if (typeof window === 'undefined') {
    throw new Error(ERROR_MESSAGES.STORAGE_BROWSER_ONLY);
  }

  try {
    const key = `${STORAGE_KEY_PREFIX}${quiz.id}`;
    const serialized = JSON.stringify(quiz);
    localStorage.setItem(key, serialized);

    // 퀴즈 ID 목록도 업데이트
    addQuizIdToList(quiz.id);

    return quiz.id;
  } catch (error) {
    console.error('Failed to save quiz to localStorage:', error);
    throw new Error(ERROR_MESSAGES.QUIZ_SAVE_FAILED);
  }
}

/**
 * ID로 퀴즈 불러오기
 *
 * @param id 퀴즈 ID
 * @returns 퀴즈 객체 또는 null
 */
export function getQuizFromLocal(id: string): Quiz | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const key = `${STORAGE_KEY_PREFIX}${id}`;
    const data = localStorage.getItem(key);

    if (!data) {
      return null;
    }

    const quiz = JSON.parse(data) as Quiz;

    // Date 객체 복원
    if (quiz.createdAt) {
      quiz.createdAt = new Date(quiz.createdAt);
    }

    return quiz;
  } catch (error) {
    console.error('Failed to load quiz from localStorage:', error);
    return null;
  }
}

/**
 * 모든 퀴즈 ID 목록 가져오기
 *
 * @returns 퀴즈 ID 배열
 */
export function getAllQuizIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const listKey = `${STORAGE_KEY_PREFIX}list`;
    const data = localStorage.getItem(listKey);

    if (!data) {
      return [];
    }

    return JSON.parse(data) as string[];
  } catch (error) {
    console.error('Failed to load quiz list:', error);
    return [];
  }
}

/**
 * 퀴즈 ID를 목록에 추가
 *
 * @param id 추가할 퀴즈 ID
 */
function addQuizIdToList(id: string): void {
  const ids = getAllQuizIds();

  if (!ids.includes(id)) {
    ids.push(id);
    const listKey = `${STORAGE_KEY_PREFIX}list`;
    localStorage.setItem(listKey, JSON.stringify(ids));
  }
}

/**
 * 퀴즈 삭제
 *
 * @param id 삭제할 퀴즈 ID
 */
export function deleteQuizFromLocal(id: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    // 퀴즈 데이터 삭제
    const key = `${STORAGE_KEY_PREFIX}${id}`;
    localStorage.removeItem(key);

    // 목록에서도 제거
    const ids = getAllQuizIds();
    const filtered = ids.filter((qid) => qid !== id);
    const listKey = `${STORAGE_KEY_PREFIX}list`;
    localStorage.setItem(listKey, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete quiz:', error);
  }
}

/**
 * 모든 퀴즈 데이터 삭제
 */
export function clearAllQuizzes(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const ids = getAllQuizIds();

    // 모든 퀴즈 삭제
    ids.forEach((id) => {
      const key = `${STORAGE_KEY_PREFIX}${id}`;
      localStorage.removeItem(key);
    });

    // 목록도 삭제
    const listKey = `${STORAGE_KEY_PREFIX}list`;
    localStorage.removeItem(listKey);
  } catch (error) {
    console.error('Failed to clear quizzes:', error);
  }
}

/**
 * 로컬 스토리지 사용 가능 여부 확인
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
