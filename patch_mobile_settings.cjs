const fs = require('fs');
let code = fs.readFileSync('src/components/MobileHome.tsx', 'utf-8');

// 1. Add ServiceLogPage import
if (!code.includes("import { ServiceLogPage }")) {
  code = code.replace("import { AdminSuggestions }", "import { AdminSuggestions }\nimport { ServiceLogPage } from './ServiceLogPage'");
}

// 2. Add /service-logs route
const specialPeriodsRoute = "            {/* 특별 봉사 시즌 관리 */}";
const serviceLogsRoute = `
            {/* 봉사 로그 조회 */}
            <Route path="/service-logs" element={
              role === 'admin' ? (
                <div className="mobile-settings-page" style={{ paddingBottom: 60 }}>
                  <AppHeader
                    pageTitle={t(language, 'settings.serviceLogs')}
                    language={language}
                    showBack
                    onBack={() => navigate('/settings')}
                    userId={currentUser.id}
                    userName={currentVisitor}
                    role={role}
                    chatUsers={headerChatUsers}
                    onOpenMenu={() => navigate('/settings')}
                  />
                  <div style={{ padding: '0 16px', marginTop: 16 }}>
                    <ServiceLogPage cards={cards} calendarEvents={calendarEvents} role={role} isEmbedded />
                  </div>
                </div>
              ) : <Navigate to="/settings" replace />
            } />
`;
if (!code.includes('path="/service-logs"')) {
  code = code.replace(specialPeriodsRoute, serviceLogsRoute + "\n" + specialPeriodsRoute);
}

// 3. Update the settings menu grouping and add buttons
// We replace the single section mobile-settings-menu with two sections
const oldMenuSectionRegex = /<section className="mobile-settings-menu" aria-label="관리 메뉴">([\s\S]*?)<\/section>\s*<div style={{ padding: '0 16px', marginBottom: 16 }}>/g;

const newMenuSections = `
                {/* [소식 & 알림] 섹션 */}
                <div style={{ marginTop: 24, paddingLeft: 16, marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', letterSpacing: 0.5 }}>소식 & 알림</div>
                <section className="mobile-settings-menu" aria-label="소식 및 알림 메뉴">
                  {role === 'admin' && (
                    <button onClick={() => navigate('/notices')} type="button">
                      <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                        <SettingsIcon name="notice" />
                      </span>
                      <span className="mobile-settings-row-text">
                        <strong>{t(language, 'settings.notice')}</strong>
                        <small>{t(language, 'settings.noticeDesc')}</small>
                      </span>
                      <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                    </button>
                  )}
                  <button onClick={() => navigate('/notification-settings')} type="button">
                    <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                      <SettingsIcon name="notification" />
                    </span>
                    <span className="mobile-settings-row-text">
                      <strong>{t(language, 'settings.notificationTitle')}</strong>
                      <small>{t(language, 'settings.notificationDesc')}</small>
                    </span>
                    <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                  </button>
                  <button onClick={() => navigate('/location-permission-settings')} type="button">
                    <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                      <SettingsIcon name="location" />
                    </span>
                    <span className="mobile-settings-row-text">
                      <strong>{t(language, 'settings.locationTitle')}</strong>
                      <small>{t(language, 'settings.locationDesc')}</small>
                    </span>
                    <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                  </button>
                </section>

                {role === 'admin' && (
                  <>
                    {/* [관리 (Admin)] 섹션 */}
                    <div style={{ marginTop: 24, paddingLeft: 16, marginBottom: 8, fontSize: 13, fontWeight: 700, color: 'var(--gray-500)', letterSpacing: 0.5 }}>관리 (Admin)</div>
                    <section className="mobile-settings-menu" aria-label="관리 메뉴">
                      <button onClick={() => navigate('/users')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="users" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.users')}</strong>
                          <small>{t(language, 'settings.usersDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/signup-requests')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="signup" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.signup')}</strong>
                          <small>{t(language, 'settings.signupDesc')}</small>
                        </span>
                        {pendingSignupCount > 0 && (
                          <span className="mobile-settings-badge" aria-label={\`승인 대기 \${pendingSignupCount}명\`}>
                            {pendingSignupCount}
                          </span>
                        )}
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/service-logs')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h10M7 12h10M7 16h6" /></svg>
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.serviceLogs')}</strong>
                          <small>{t(language, 'settings.serviceLogsDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/special-periods')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-season" aria-hidden="true">
                          <SettingsIcon name="season" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.specialSeason')}</strong>
                          <small>{t(language, 'settings.specialSeasonDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                      <button onClick={() => navigate('/suggestions')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>{t(language, 'settings.suggestions')}</strong>
                          <small>{t(language, 'settings.suggestionsDesc')}</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
                    </section>
                  </>
                )}

                <div style={{ padding: '0 16px', marginBottom: 16 }}>`;

code = code.replace(oldMenuSectionRegex, newMenuSections);

fs.writeFileSync('src/components/MobileHome.tsx', code);
