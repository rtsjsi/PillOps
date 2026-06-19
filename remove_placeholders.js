const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, files);
    } else if (filePath.endsWith('.tsx')) {
      files.push(filePath);
    }
  }
  return files;
}

const files = getFiles(path.join(__dirname, 'src'));
let count = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Remove placeholder="text"
  content = content.replace(/\splaceholder=(['"]).*?\1/g, '');
  
  // Remove placeholder={`text`} or placeholder={'text'} or placeholder={var}
  content = content.replace(/\splaceholder=\{.*?\}/g, '');
  
  // For default props like function({ placeholder = 'Search' })
  content = content.replace(/placeholder\s*=\s*(['"]).*?\1/g, 'placeholder');

  // Fix the duplicate className in command-palette.tsx that I just caused
  if (file.includes('command-palette.tsx')) {
    content = content.replace(/className="flex h-16 w-full bg-transparent py-4 text-lg outline-none placeholder:text-muted-foreground px-4"\s+className="flex h-16 w-full bg-transparent py-4 text-lg outline-none placeholder:text-muted-foreground px-4"/g, 'className="flex h-16 w-full bg-transparent py-4 text-lg outline-none placeholder:text-muted-foreground px-4"');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated ' + file);
    count++;
  }
}
console.log(`Total files updated: ${count}`);
