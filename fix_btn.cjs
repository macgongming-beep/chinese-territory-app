const fs = require('fs');
let code = fs.readFileSync('src/components/MobileLeaderAssignment.tsx', 'utf-8');

const oldStyle = /style=\{\{\s*position:\s*'absolute',\s*top:\s*-6,\s*right:\s*-6,\s*width:\s*22,\s*height:\s*22,\s*borderRadius:\s*'50%',\s*background:\s*'var\(--status-danger\)',\s*color:\s*'white',\s*border:\s*'2px solid var\(--surface\)',\s*display:\s*'flex',\s*alignItems:\s*'center',\s*justifyContent:\s*'center',\s*zIndex:\s*2,\s*cursor:\s*'pointer',\s*boxShadow:\s*'0 2px 4px rgba\(0,0,0,0\.1\)'\s*\}\}/;

const newStyle = `style={{
                                      position: 'absolute',
                                      top: '50%',
                                      right: -6,
                                      transform: 'translateY(-50%)',
                                      width: 20,
                                      height: 20,
                                      minWidth: 20,
                                      padding: 0,
                                      borderRadius: '50%',
                                      background: 'var(--status-danger)',
                                      color: 'white',
                                      border: '2px solid var(--surface)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      zIndex: 2,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}`;

if (code.match(oldStyle)) {
  code = code.replace(oldStyle, newStyle);
  fs.writeFileSync('src/components/MobileLeaderAssignment.tsx', code);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find the old style block.");
}
