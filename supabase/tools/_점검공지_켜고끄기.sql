-- 점검 공지 팝업을 **배포 없이** 켜고 끈다.
-- 앱이 뜰 때 app_settings 를 읽어 팝업을 띄운다 (체크박스를 눌러야 닫힌다).
--
-- ⚠ 전환 뒤에는 app_settings 쓰기가 **관리자만** 되므로,
--   SQL Editor(=postgres)로 하거나 관리자 세션으로 해야 한다.

-- ═══ 켜기 ═══
insert into public.app_settings (key, value) values
  ('maintenance_notice_id', 'lockdown-2026-08-29'),   -- 바꾸면 확인했던 사람에게도 다시 뜬다

  -- ⚠ 문구는 **제일 쉬운 방법을 앞에** 둔다. 62명 중 어른이 많다.
  --   '설정의 업데이트 버튼' 한 번이면 끝난다 — 앱을 밀어 닫는 것보다 훨씬 쉽다.
  --   ⚠ "최근 앱 목록에서 지운다" 를 **앱 삭제로 오해**한다. 그렇게 쓰지 말 것.
  ('maintenance_notice', E'8월 29일 밤 10시경 잠깐 점검이 있습니다.\n\n' ||
    E'아래 둘 중 **하나만** 해 주시면 됩니다.\n\n' ||
    E'1) 설정 화면에 "업데이트" 버튼이 보이면 눌러 주세요. (제일 간단합니다)\n\n' ||
    E'2) 버튼이 안 보이면, 앱을 닫았다가 다시 열어 주세요.\n' ||
    E'   (화면을 위로 쓸어올려 나오는 앱 목록에서 필드맵을 위로 밀어 닫은 뒤,\n' ||
    E'    다시 아이콘을 눌러 실행하시면 됩니다. 앱을 지우실 필요는 없습니다.)\n\n' ||
    E'안 하시면 점검 뒤에 기록이 저장되지 않을 수 있습니다.\n' ||
    E'그럴 때도 위 방법대로 하시면 바로 정상으로 돌아옵니다.\n\n' ||
    E'이 안내가 보인다면 앱은 이미 최신입니다. 확인만 눌러 주세요.'),

  -- 중국어·영어 본문. **안 넣으면 한국어로 떨어진다** (화면이 비지는 않는다).
  ('maintenance_notice_zh', E'8月29日晚上10点左右将进行短暂维护。\n\n' ||
    E'以下两种方法**任选其一**即可。\n\n' ||
    E'1) 如果设置页面出现"更新"按钮，请点击它。（最简单）\n\n' ||
    E'2) 如果没有该按钮，请关闭应用后重新打开。\n' ||
    E'   （向上滑动调出应用列表，将本应用向上滑动关闭，然后重新点击图标启动。\n' ||
    E'    无需删除应用。）\n\n' ||
    E'否则维护后可能无法保存记录。\n' ||
    E'出现这种情况时，按上述方法操作即可恢复正常。\n\n' ||
    E'能看到这条通知，说明您的应用已是最新版本。点击确认即可。'),

  ('maintenance_notice_en', E'There will be a brief maintenance around 10 PM on Aug 29.\n\n' ||
    E'Please do **just one** of the following.\n\n' ||
    E'1) If you see an "Update" button in Settings, tap it. (Easiest)\n\n' ||
    E'2) If there is no such button, close the app and open it again.\n' ||
    E'   (Swipe up to show the app list, swipe this app away, then tap the icon again.\n' ||
    E'    You do not need to delete the app.)\n\n' ||
    E'Otherwise your records may not save after the maintenance.\n' ||
    E'If that happens, doing the above fixes it right away.\n\n' ||
    E'If you can see this notice, your app is already up to date. Just tap OK.')
on conflict (key) do update set value = excluded.value, updated_at = now();

notify pgrst, 'reload schema';

-- ═══ 끄기 (점검 끝난 뒤) ═══
-- 한국어 칸만 비우면 꺼진다 (그 칸이 비면 공지 자체가 없는 것으로 본다).
-- update public.app_settings set value = '', updated_at = now()
--  where key = 'maintenance_notice';

-- ═══ 지금 켜져 있나 ═══
-- select key, left(value, 60) as 앞부분, updated_at
--   from public.app_settings where key like 'maintenance\_%';
