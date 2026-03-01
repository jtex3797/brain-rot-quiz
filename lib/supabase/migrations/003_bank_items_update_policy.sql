-- question_bank_items UPDATE RLS 정책 추가
-- 배경: 더 풀기로 bank에서 로드된 문제 수정 시 PATCH가 question_bank_items를 업데이트할 수 있도록
DROP POLICY IF EXISTS "Anyone can update bank items" ON public.question_bank_items;
CREATE POLICY "Anyone can update bank items"
  ON public.question_bank_items FOR UPDATE
  USING (TRUE);
