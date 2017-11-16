require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const Raven = require('raven');
const compression = require('compression');
const cors = require('cors');

const loadPassport = require('./auth/passport');
const loadErrorHandlers = require('./error-handlers');
const loadHealthChecks = require('./health-checks');
const loadHookManifest = require('./hook-manifest');
const loadApi = require('./api-handler');
const loadHooks = require('./hook-handler');

const db = require('./db');

const app = express();
const port = process.env.PORT || 2112;

db.connect();

if (process.env.RAVEN_DSN) app.use(Raven.requestHandler());
const CORS = cors({
  allowedHeaders: 'content-type, x-total-count, content-range, authorization, x-organization',
  exposedHeaders: 'x-total-count, content-range, x-organization'
});
app.options('*', CORS);
app.use(CORS);
app.use(helmet());
app.use(helmet.noCache());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(compression({ level: 6, memLevel: 8 }));

loadPassport(app);

// @todo replace with UI
app.get('/', (req, res) => {
  let response = {
    name: 'hookr',
    links: {
      index: process.env.NODE_HOSTNAME,
      repo: 'https://github.com/cygnusb2b/hookr',
      manifest: `${process.env.NODE_HOSTNAME}/hook-manifest.json`
    }
  };
  if (req.user) {
    response.user = req.user;
    delete response.user._json;
    delete response.user._raw;
    response.links.logout = `${process.env.NODE_HOSTNAME}/logout`;
    response.links.api = {
      publishers: []
    };
    response.user.orgs.forEach(org => response.links.api.publishers.push(`${process.env.NODE_HOSTNAME}/api/${org}/publishers`));
  } else {
    response.links.login = `${process.env.NODE_HOSTNAME}/login`;
  }
  res.json(response);
})

loadHookManifest(app);
loadApi(app);
loadHooks(app);
loadHealthChecks(app);
loadErrorHandlers(app);

app.listen(port);
process.stdout.write(`\nHookr server listening on port ${port}\n`);
