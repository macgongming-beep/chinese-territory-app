const fs = require('fs');
let code = fs.readFileSync('src/i18n.ts', 'utf-8');

const koAnchor = "'settings.specialSeasonDesc': '현재 시즌 수정 · 새 시즌 추가',";
const koInsert = `
    'settings.suggestions': '대화 방법 제안 관리',
    'settings.suggestionsDesc': '대화 방법 추가 및 수정',
    'settings.serviceLogs': '봉사 로그 조회',
    'settings.serviceLogsDesc': '회중 전체 봉사 활동 조회',`;
if(!code.includes("'settings.suggestions': '대화 방법 제안 관리'")) {
  code = code.replace(koAnchor, koAnchor + koInsert);
}

const zhAnchor = "'settings.specialSeasonDesc': '修改当前季 · 新增季',";
const zhInsert = `
    'settings.suggestions': '传道话题建议管理',
    'settings.suggestionsDesc': '修改和添加话题建议',
    'settings.serviceLogs': '传道记录查询',
    'settings.serviceLogsDesc': '查询会众所有传道活动',`;
if(!code.includes("'settings.suggestions': '传道话题建议管理'")) {
  code = code.replace(zhAnchor, zhAnchor + zhInsert);
}

const enAnchor = "'settings.specialSeasonDesc': 'Edit current season · Add new season',";
const enInsert = `
    'settings.suggestions': 'Conversation Starters',
    'settings.suggestionsDesc': 'Edit and add conversation starters',
    'settings.serviceLogs': 'Service Logs',
    'settings.serviceLogsDesc': 'View all congregation service activity',`;
if(!code.includes("'settings.suggestions': 'Conversation Starters'")) {
  code = code.replace(enAnchor, enAnchor + enInsert);
}

fs.writeFileSync('src/i18n.ts', code);
