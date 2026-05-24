import re

def insert_route():
    with open('src/components/MobileHome.tsx', 'r') as f:
        content = f.read()

    # Import AdminSuggestions
    if 'import { AdminSuggestions }' not in content:
        content = re.sub(
            r"import \{ MobileSignupRequests \} from '\./MobileSignupRequests'",
            "import { MobileSignupRequests } from './MobileSignupRequests'\nimport { AdminSuggestions } from './admin/AdminSuggestions'",
            content
        )

    # Insert Route
    route_snippet = """
            {/* 봉사 제안 관리 */}
            <Route path="/suggestions" element={
              role === 'admin' ? (
                <div className="mobile-settings-page" style={{ paddingBottom: 60 }}>
                  <AdminSuggestions onBack={() => navigate('/settings')} />
                </div>
              ) : (
                <Navigate to="/settings" replace />
              )
            } />
    """
    if '/suggestions' not in content:
        content = re.sub(
            r"(\{\/\* 알림 설정 \*\/\})",
            route_snippet + r"\n            \1",
            content
        )

    # Insert Button
    button_snippet = """
                      <button onClick={() => navigate('/suggestions')} type="button">
                        <span className="mobile-settings-icon mobile-settings-icon-neutral" aria-hidden="true">
                          <SettingsIcon name="notice" />
                        </span>
                        <span className="mobile-settings-row-text">
                          <strong>대화 방법 제안 관리</strong>
                          <small>홈 화면 봉사 제안 문구 관리</small>
                        </span>
                        <span className="mobile-settings-chevron" aria-hidden="true">›</span>
                      </button>
    """
    if '대화 방법 제안 관리' not in content:
        content = re.sub(
            r"(\{\/\* 데이터 관리 \*\/\})",
            button_snippet + r"\n                      \1",
            content
        )
        # Fallback if "데이터 관리" not found
        if '대화 방법 제안 관리' not in content:
            content = re.sub(
                r"(<small>\{t\(language, 'settings\.dataDesc'\)\}<\/small>\s*<\/span>\s*<span className=\"mobile-settings-chevron\" aria-hidden=\"true\">›<\/span>\s*<\/button>)",
                r"\1" + button_snippet,
                content
            )

    with open('src/components/MobileHome.tsx', 'w') as f:
        f.write(content)

insert_route()
print("Done inserting mobile routes.")
