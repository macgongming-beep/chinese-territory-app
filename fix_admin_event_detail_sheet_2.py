with open('src/components/admin/AdminEventDetailSheet.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if "        {/* 신청자 — 디자인 02b 가로 스크롤 칩 strip */}" in line:
        new_lines.append(line)
        new_lines.append("        {!hideParticipants && (\n")
        continue

    if "        <CommentSection" in line:
        # Check if the previous line is "        )}\n"
        if new_lines[-1] == "        )}\n":
            pass # Already added
        else:
            new_lines.append("        )}\n\n")
        new_lines.append(line)
        continue
    
    if i == 475 and line.strip() == ")}":
        continue # skip the broken one

    new_lines.append(line)

with open('src/components/admin/AdminEventDetailSheet.tsx', 'w') as f:
    f.writelines(new_lines)
