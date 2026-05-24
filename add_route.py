import re

with open('src/components/DesktopApp.tsx', 'r') as f:
    content = f.read()

route_str = """
          <Route path="suggestions" element={
            (viewMode === 'admin' || viewMode === 'developer')
              ? <AdminSuggestions language={language} onBack={() => window.history.back()} />
              : <Navigate to="/settings/profile" replace />
          } />
"""

content = content.replace(
    '<Route path="notification" element=',
    route_str + '          <Route path="notification" element='
)

with open('src/components/DesktopApp.tsx', 'w') as f:
    f.write(content)
