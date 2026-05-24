import re

with open('src/App.css', 'r') as f:
    css = f.read()

# Fix .card-table columns
# Old: 34px minmax(220px, 1.4fr) 110px 92px 62px 70px 74px 70px 70px 142px
# New: 34px minmax(200px, 1.2fr) minmax(110px, 1fr) minmax(100px, 1fr) minmax(160px, 1.5fr) 70px 80px 70px 80px 142px
css = re.sub(
    r'grid-template-columns:\s*34px minmax\(220px, 1.4fr\) 110px 92px 62px 70px 74px 70px 70px 142px;',
    r'grid-template-columns: 34px minmax(200px, 1.5fr) minmax(110px, 1fr) minmax(100px, 1fr) minmax(180px, 1.5fr) 70px 80px 70px 80px 142px;',
    css
)

# Fix .building-management-table columns
# Old: 34px minmax(130px, 1fr) minmax(200px, 1.35fr) minmax(150px, 0.9fr) 56px 58px 62px 54px 56px minmax(100px, 0.8fr) 102px
# New: 34px minmax(130px, 1.5fr) minmax(200px, 2fr) minmax(150px, 1.5fr) minmax(60px, 1fr) 60px 70px 60px 60px minmax(120px, 1fr) 120px
css = re.sub(
    r'grid-template-columns:\s*34px minmax\(130px,\s*1fr\) minmax\(200px,\s*1.35fr\) minmax\(150px,\s*0.9fr\) 56px 58px 62px 54px 56px minmax\(100px,\s*0.8fr\) 102px;',
    r'grid-template-columns: 34px minmax(130px, 1.5fr) minmax(200px, 2fr) minmax(150px, 1.5fr) minmax(60px, 1fr) 60px 70px 60px 60px minmax(120px, 1fr) 120px;',
    css
)

# Fix .point-management-table columns
# Old: minmax(130px,0.9fr) minmax(160px,1.1fr) minmax(150px,1.1fr) minmax(90px,0.65fr) minmax(150px,1fr) minmax(150px,1fr) 56px
# New: minmax(130px,1fr) minmax(160px,1.5fr) minmax(150px,1.5fr) minmax(90px,1fr) minmax(150px,1fr) minmax(150px,1fr) 60px
css = re.sub(
    r'grid-template-columns:\s*minmax\(130px,0\.9fr\) minmax\(160px,1\.1fr\) minmax\(150px,1\.1fr\) minmax\(90px,0\.65fr\) minmax\(150px,1fr\) minmax\(150px,1fr\) 56px;',
    r'grid-template-columns: minmax(130px,1fr) minmax(160px,1.5fr) minmax(150px,1.5fr) minmax(90px,1fr) minmax(150px,1fr) minmax(150px,1fr) 60px;',
    css
)

with open('src/App.css', 'w') as f:
    f.write(css)

print("Grid columns updated")
