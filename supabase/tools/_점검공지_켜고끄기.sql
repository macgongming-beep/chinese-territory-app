-- 점검 공지 팝업을 **배포 없이** 켜고 끈다.
-- 앱이 뜰 때 app_settings 를 읽어 팝업을 띄운다 (체크박스를 눌러야 닫힌다).
--
-- ⚠ 전환 뒤에는 app_settings 쓰기가 **관리자만** 되므로,
--   SQL Editor(=postgres)로 하거나 관리자 세션으로 해야 한다.

-- ═══ 켜기 ═══
insert into public.app_settings (key, value) values
  ('maintenance_notice_id', 'informal-assignment-2026-09-04'), -- 바꾸면 확인했던 사람에게도 다시 뜬다

  -- ⚠ 짧게 쓴다. 설명이 길면 안 읽는다.
  ('maintenance_notice', E'업데이트가 있습니다.\n앱을 완전히 종료한 뒤 다시 실행해 주세요.'),
  ('maintenance_notice_zh', E'有新版本。\n请完全关闭应用后重新启动。'),
  ('maintenance_notice_en', E'An update is available.\nPlease fully close the app and restart it.')
on conflict (key) do update set value = excluded.value, updated_at = now();

notify pgrst, 'reload schema';

-- ═══ 끄기 (점검 끝난 뒤) ═══
-- 한국어 칸만 비우면 꺼진다 (그 칸이 비면 공지 자체가 없는 것으로 본다).
-- update public.app_settings set value = '', updated_at = now()
--  where key = 'maintenance_notice';

-- ═══ 지금 켜져 있나 ═══
-- select key, left(value, 60) as 앞부분, updated_at
--   from public.app_settings where key like 'maintenance\_%';
