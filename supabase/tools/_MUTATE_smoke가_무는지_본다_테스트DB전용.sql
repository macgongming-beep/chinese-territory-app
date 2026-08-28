-- ⚠ **테스트 DB 전용.** 일부러 구멍을 뚫어 **smoke 가 무는지** 본다.
--    (운영에 돌리면 cards 가 다시 아무나 쓸 수 있게 된다)
--
-- 왜: 통과하는 시험과 무는 시험은 다르다. 오늘만 헛도는 시험을 다섯 개 잡았다.
--     "22개 전부 통과" 가 **아무것도 안 검사하고 있어도** 나올 수 있는 말인지 본다.
--
-- 쓰는 법:
--   ① 이 파일의 [뚫기] 부분을 돌린다
--   ② npm run smoke:lockdown  →  **①의 네 검사가 실패해야 한다**
--        · 헤더 없이 카드 INSERT 가 막힌다
--        · 정말 안 만들어졌다
--        · 헤더 없이 있는 행을 UPDATE 못 한다 / DELETE 못 한다
--      실패 안 하면 **그 검사들은 아무것도 안 보고 있는 것이다**
--   ③ [메우기] 를 돌려 원래대로

-- ═══ [뚫기] cards 를 다시 아무나 쓸 수 있게 ═══
create policy _mutation_hole on public.cards
  for all to anon using (true) with check (true);

-- ═══ [메우기] — ② 를 확인한 **뒤에** 돌릴 것 ═══
-- drop policy _mutation_hole on public.cards;
