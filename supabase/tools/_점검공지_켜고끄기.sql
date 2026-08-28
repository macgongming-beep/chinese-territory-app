-- 점검 공지 팝업을 **배포 없이** 켜고 끈다.
-- 앱이 뜰 때 app_settings 를 읽어 팝업을 띄운다 (체크박스를 눌러야 닫힌다).
--
-- ⚠ 전환 뒤에는 app_settings 쓰기가 **관리자만** 되므로,
--   SQL Editor(=postgres)로 하거나 관리자 세션으로 해야 한다.

-- ═══ 켜기 ═══
insert into public.app_settings (key, value) values
  ('maintenance_notice_id', 'lockdown-2026-08-29'),   -- 바꾸면 확인했던 사람에게도 다시 뜬다
  ('maintenance_notice', E'8월 29일 밤 10시경 잠깐 점검이 있습니다.\n\n' ||
    E'**점검 전에 앱을 완전히 껐다가 다시 열어 주세요.**\n' ||
    E'홈 화면 아이콘으로 쓰시는 분은 최근 앱 목록에서도 지운 뒤 다시 실행해 주세요.\n\n' ||
    E'안 하시면 점검 뒤에 기록이 저장되지 않을 수 있습니다.\n' ||
    E'그럴 때도 앱을 껐다 켜면 바로 정상으로 돌아옵니다.\n\n' ||
    E'이 안내가 보인다면 앱은 이미 최신입니다. 껐다 켜기만 해 주세요.')
on conflict (key) do update set value = excluded.value, updated_at = now();

notify pgrst, 'reload schema';

-- ═══ 끄기 (점검 끝난 뒤) ═══
-- update public.app_settings set value = '', updated_at = now()
--  where key = 'maintenance_notice';

-- ═══ 지금 켜져 있나 ═══
-- select key, left(value, 60) as 앞부분, updated_at
--   from public.app_settings where key like 'maintenance\_%';
