const fs = require('fs');
let code = fs.readFileSync('src/components/MobileAdminAssignment.tsx', 'utf-8');

code = code.replace('<Check color="#fff" size={12} strokeWidth={3} />', `<svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="5 13 10 18 19 8" />
          </svg>`);

// Also suppress or remove Avatar
code = code.replace(/function Avatar\(/g, '// @ts-ignore\\nfunction Avatar(');

fs.writeFileSync('src/components/MobileAdminAssignment.tsx', code);
