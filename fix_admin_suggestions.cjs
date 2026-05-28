const fs = require('fs');
let code = fs.readFileSync('src/components/admin/AdminSuggestions.tsx', 'utf-8');

code = code.replace(/const downloadSampleCSV = \(\) => \{\s*const content = [\s\S]*?\}\n/, '');

fs.writeFileSync('src/components/admin/AdminSuggestions.tsx', code);
