try {
  JSON.parse('{"a":1,}');
} catch(e) {
  console.error("Error 1:", e.message);
}

try {
  JSON.parse('{"a":1, "b":}');
} catch(e) {
  console.error("Error 2:", e.message);
}
