import re

def inject(filename, search_pattern):
    with open(filename, 'r') as f:
        content = f.read()
    
    # We find the end of the first section (오늘의 봉사)
    # Both files have:
    #       </section>
    #
    #       {/* ── 
    
    # Let's find the second section start.
    if 'Admin' in filename:
        content = re.sub(r'(\s*)\{\/\* ── 운영 현황)', r'\1<ServiceSuggestionsSection />\1{/* ── 운영 현황', content)
    else:
        content = re.sub(r'(\s*)\{\/\* ─── 오늘 봉사 — 디자인 24\/25)', r'\1<ServiceSuggestionsSection />\1{/* ─── 오늘 봉사 — 디자인 24/25', content)
        
    with open(filename, 'w') as f:
        f.write(content)

inject('src/components/admin/AdminMobileHome.tsx', '')
inject('src/components/UserMobileHome.tsx', '')
print("done")
