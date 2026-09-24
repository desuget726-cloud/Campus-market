/*
 * xgrep security scanner — demo file. SAFE TO EDIT OR DELETE.
 *
 * Every line flagged below is a *deliberate* vulnerability so you can see the
 * scanner work. Hover a squiggle, or press Ctrl+. / Cmd+. on it, to:
 *   • Apply xgrep fix        — when the rule ships an automatic fix
 *   • Suppress finding…      — dismiss with a reason (a nogrep comment)
 *   • Explain finding (AI)   — a security review of whether it's real here
 *
 * Try fixing one and watch the finding disappear.
 */

const { exec } = require('child_process');
const fs = require('fs');
const express = require('express');
const app = express();

// A password hardcoded in source — anyone with the repo can read it.
const password = 'Sup3rS3cr3tP@ssw0rd_9aZ8bY7c';

// Untrusted input flows through a helper into a shell — xgrep tracks the value
// across the function call, not just on one line.
function pingHost(host) {
  return exec('ping -c1 ' + host); // command injection
}

app.get('/ping', (req, res) => {
  pingHost(req.query.host);
  res.end('ok');
});

app.get('/read', (req, res) => {
  const data = fs.readFileSync('/var/docs/' + req.query.file); // path traversal
  res.end(data);
});

app.get('/calc', (req, res) => {
  res.end(String(eval(req.query.expr))); // code injection
});

app.listen(3000);
