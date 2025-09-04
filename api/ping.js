// api/ping.js
module.exports = (req, res) => {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, now: new Date().toISOString() }));
};
