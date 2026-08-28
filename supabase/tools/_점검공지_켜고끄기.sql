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
    E'이 안내가 보인다면 앱은 이미 최신입니다. 껐다 켜기만 해 주세요.'),

  -- 중국어·영어 본문. **안 넣으면 한국어로 떨어진다** (화면이 비지는 않는다).
  ('maintenance_notice_zh', E'8月29日晚上10点左右将进行短暂维护。\n\n' ||
    E'**维护前请完全关闭应用后重新打开。**\n' ||
    E'使用主屏幕图标的话，请从最近应用列表中也移除后再重新启动。\n\n' ||
    E'否则维护后可能无法保存记录。\n' ||
    E'出现这种情况时，只要关闭应用再打开就会恢复正常。\n\n' ||
    E'能看到这条通知，说明您的应用已是最新版本。只需关闭后重新打开即可。'),

  ('maintenance_notice_en', E'There will be a brief maintenance around 10 PM on Aug 29.\n\n' ||
    E'**Please fully close and reopen the app before then.**\n' ||
    E'If you use the home screen icon, also remove it from the recent apps list, then relaunch.\n\n' ||
    E'Otherwise your records may not save after the maintenance.\n' ||
    E'If that happens, closing and reopening the app fixes it right away.\n\n' ||
    E'If you can see this notice, your app is already up to date. Just close and reopen it.')
on conflict (key) do update set value = excluded.value, updated_at = now();

notify pgrst, 'reload schema';

-- ═══ 끄기 (점검 끝난 뒤) ═══
-- 한국어 칸만 비우면 꺼진다 (그 칸이 비면 공지 자체가 없는 것으로 본다).
-- update public.app_settings set value = '', updated_at = now()
--  where key = 'maintenance_notice';

-- ═══ 지금 켜져 있나 ═══
-- select key, left(value, 60) as 앞부분, updated_at
--   from public.app_settings where key like 'maintenance\_%';
