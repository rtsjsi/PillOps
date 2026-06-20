function fixJson(jsonString) {
  let inString = false;
  let escape = false;
  let result = '';
  for (let i = 0; i < jsonString.length; i++) {
    const char = jsonString[i];
    
    if (char === '\\' && !escape) {
      escape = true;
      result += char;
      continue;
    }
    if (char === '"' && !escape) {
      inString = !inString;
    }
    escape = false;
    
    if (inString) {
      const code = char.charCodeAt(0);
      if (code < 32) {
        result += ' ';
        continue;
      }
    }
    
    if (!inString && char === ',') {
      let nextChar = '';
      for (let j = i + 1; j < jsonString.length; j++) {
        if (jsonString[j] !== ' ' && jsonString[j] !== '\n' && jsonString[j] !== '\r' && jsonString[j] !== '\t') {
          nextChar = jsonString[j];
          break;
        }
      }
      if (nextChar === '}' || nextChar === ']') {
        continue; 
      }
    }
    
    result += char;
  }
  return result;
}

const badJson1 = '{\n  "name": "Line 1\nLine 2",\n  "test": 1,\n}';

console.log(fixJson(badJson1));
JSON.parse(fixJson(badJson1));
console.log("Passed!");
