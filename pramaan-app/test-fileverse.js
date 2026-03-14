const fetch = require('node-fetch');
async function run() {
  const res = await fetch('http://localhost:8001/api/ddocs?apiKey=8gqxM-bxHZ0cbIZSlK8cnFxMoq1yMiJL', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', content: 'Test content' })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
