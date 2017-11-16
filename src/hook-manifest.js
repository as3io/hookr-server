module.exports = (app) => {
  app.get('/hook-manifest.json', (req, res) => {
    res.json({
      application: {
        name: 'Hookr',
        url: 'https://hookr.as3.io'
      },
      hooks: [
        {
          key: 'test',
          description: 'Testing endpoint for subscribing applications'
        }
      ]
    })
  })
};
