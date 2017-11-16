const Raven = require('raven');
const eh4xx = require('./error-handlers/4xx');
const eh5xx = require('./error-handlers/5xx');
const eh404 = require('./error-handlers/404');

if (process.env.RAVEN_DSN) Raven.config(process.env.RAVEN_DSN).install();

module.exports = (app) => {
  app.use(eh4xx);
  if (process.env.RAVEN_DSN) app.use(Raven.errorHandler());
  app.use(eh5xx);
  app.use(eh404);
};
