# 백업 / 복원

## 백업 실행

```bash
npm run backup
```

`backups/YYYY-MM-DD/` 폴더에 모든 테이블이 JSON 으로 저장됩니다.

`.env.local` 에 다음 두 변수가 필요:
```
VITE_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## 자동화 (macOS launchd, 매주 일요일 03:00)

다음 plist 파일을 만들어서 등록:

```bash
# 1. plist 파일 생성
cat > ~/Library/LaunchAgents/com.chinese-territory.backup.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.chinese-territory.backup</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-c</string>
    <string>cd "/Users/gm/Documents/New project/chinese-territory-app" && /usr/local/bin/npm run backup</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key>
    <integer>0</integer>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/chinese-territory-backup.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/chinese-territory-backup-error.log</string>
</dict>
</plist>
EOF

# 2. 등록
launchctl load ~/Library/LaunchAgents/com.chinese-territory.backup.plist

# 3. 확인
launchctl list | grep chinese-territory
```

해제:
```bash
launchctl unload ~/Library/LaunchAgents/com.chinese-territory.backup.plist
rm ~/Library/LaunchAgents/com.chinese-territory.backup.plist
```

## 복원 (수동)

전체 복원은 위험하므로 신중히 진행. 일반적으로 특정 테이블 일부만 복원합니다.

### 옵션 A: 단일 행 복원 (Supabase Dashboard)
1. `backups/YYYY-MM-DD/<table>.json` 열기
2. 잃어버린 행 찾기
3. Supabase Table Editor 에서 직접 INSERT

### 옵션 B: 전체 테이블 복원 (SQL Editor)
```sql
-- 1. 기존 데이터 삭제 (주의!)
TRUNCATE public.<table_name> CASCADE;

-- 2. JSON 데이터 복원 (psql 또는 pg_restore 필요)
-- backups/YYYY-MM-DD/<table>.json 의 내용을 INSERT 문으로 변환 필요
```

### 옵션 C: Node.js 스크립트로 복원
필요시 `scripts/restore.js` 작성. 현재 미구현.

## 백업 보관

- `backups/` 는 `.gitignore` 에 등록되어 git 에 커밋되지 않습니다 (민감 정보 포함)
- 권장: 매월 1회 외장 디스크 또는 iCloud 에 복사
- 비밀번호 해시값이 포함되어 있으므로 외부 노출 금지

## 백업 파일 구조

```
backups/2026-04-30/
├── _meta.json              # 백업 메타정보 (시각, 행 수 등)
├── app_users.json
├── login_logs.json
├── cards.json
├── buildings.json
├── ...
└── (총 18개 테이블)
```

각 JSON 은 `[{컬럼: 값, ...}, ...]` 형태의 배열.
