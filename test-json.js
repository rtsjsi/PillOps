const j = '{\n  "test": "abc\ndef"\n}';
try {
  JSON.parse(j);
  console.log('Parsed successfully');
} catch(e) {
  console.log('Error:', e.message);
  const fixed = j.replace(/[\u0000-\u001F]+/g, ' ');
  console.log('Fixed parse:', JSON.parse(fixed));
}
