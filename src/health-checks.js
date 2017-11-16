module.exports = (app) => {
  app.get('/__ping', (req, res) => {
    res.json({ ok: true });
  });
};
