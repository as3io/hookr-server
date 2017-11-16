const db = require('./db');
const uuidv4 = require('uuid/v4');
const http = require('http');
const https = require('https');
const passport = require('passport');

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
};

const ensureOrgMember = (req, res, next) => {
  return next();
  const org = req.params.organization;

  if (req.isAuthenticated()) {
    if (req.user.orgs.includes(org)) return next();
    const err = new Error(`You do not have access to the organization "${org}".`);
    err.status = 403;
    return next(err);
  }
  const err = new Error('Authentication required.');
  err.status = 401;
  next(err);
}

const appendCount = (res, coll, criteria) => {
  return coll.count(criteria)
    .then(count => res.set('X-Total-Count', count))
    .then(() => coll)
  ;
}

const setCriteriaFromRequest = (req) => {
  const organization = req.get('x-organization');
  const criteria = { organization };
  if (req.params._id !== undefined) {
    criteria._id = db.getObjectId(req.params._id);
  }
  return criteria;
}

const setFindOptionsFromRequest = (req) => {
  const options = {
    limit: 10,
    sort: [['_id', 1]],
    skip: 0
  }
  if (req.query._end) {
    options.skip = parseInt(req.query._start);
    options.limit = parseInt(req.query._end) - parseInt(req.query._start);
  }
  if (req.query._sort) {
    const { _sort, _order } = req.query;
    const order = req.query._order === 'DESC' ? -1 : 1;
    const sort = _sort === 'id' ? '_id' : _sort;
    options.sort = [[sort, order]];
  }

  return options;
}

const formatDocument = (document) => {
  // Primary key
  if (null === document) {
    return {};
  }
  const id = document._id || null;
  delete document._id;
  document.id = id;
  // ... rels/etc
  return document;
}

module.exports = (app) => {
  /**
   * LIST
   */
  app.get('/api/:modelType', passport.authenticate('jwt', { session: false }), (req, res, next) => {
    const criteria = setCriteriaFromRequest(req);
    const options = setFindOptionsFromRequest(req);
    Promise.resolve(db.selectCollection('hookr', req.params.modelType))
      .then(coll => appendCount(res, coll, criteria))
      .then(coll => coll.find(criteria, options))
      .then((cursor) => cursor.toArray((err, data) => {
        data.map(el => formatDocument(el));
        return res.json(data)
      }))
    ;
  })

  /**
   * RETRIEVE
   */
  app.get('/api/:modelType/:_id', passport.authenticate('jwt', { session: false }), (req, res, next) => {
    const criteria = setCriteriaFromRequest(req);

    Promise.resolve(db.selectCollection('hookr', req.params.modelType))
      .then(coll => appendCount(res, coll, criteria))
      .then(coll => {
        if (parseInt(res.get('X-Total-Count')) === 0) {
          const err = new Error('Not Found');
          err.status = 404;
          next(err);
        }
        return coll;
      })
      .then(coll => coll.findOne(criteria))
      .then(doc => res.json(formatDocument(doc)));
  })

  /**
   * CREATE
   */
  app.post('/api/:modelType', passport.authenticate('jwt', { session: false }), (req, res, next) => {
    const criteria = setCriteriaFromRequest(req);
    const data = req.body;
    data.organization = criteria.organization;
    data.deleted = false;
    if (req.params.modelType === 'publishers') data.apiKey = uuidv4();

    const check = new Promise((resolve, reject) => {
      if (req.params.modelType === 'publishers' && data.hasOwnProperty('url')) {
        const transport = -1 !== data.url.indexOf('https') ? https : http;
        const manifestUrl = `${data.url}/hook-manifest.json`;
        process.stdout.write(`Checking for hook manifest: ${manifestUrl}\n`);
        const request = transport.get(manifestUrl, (res) => {
          res.setEncoding('utf8');
          let rawData = '';
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const parsedData = JSON.parse(rawData);
              resolve(parsedData);
            } catch (e) {
              reject(e);
            }
          });
        });
        request.on('error', reject);
        request.end();
      } else {
        resolve();
      }
    })

    return Promise.resolve(check)
      .then(() => db.selectCollection('hookr', req.params.modelType))
      .then(coll => coll.insert(data))
      .then(doc => res.json(formatDocument(data)))
      .then(() => check)
      .then(body => {
        body.hooks.forEach(hook => {
          const publisher = data.id;
          const { organization, deleted } = data;
          const { key, description } = hook;
          const payload = { publisher, organization, deleted, key, description };
          console.warn('Creating hook', payload);
          return Promise.resolve(db.getHookCollection())
            .then(coll => coll.insert(payload))
        })
      })
      .catch(e => console.warn(e))
      ;
  })

  /**
   * UPDATE
   */
  app.put('/api/:modelType/:_id', passport.authenticate('jwt', { session: false }), (req, res, next) => {
    const data = req.body;
    const criteria = setCriteriaFromRequest(req);
    data.organization = criteria.organization;
    Promise.resolve(db.selectCollection('hookr', req.params.modelType))
      .then(coll => coll.update(criteria, data))
      .then(doc => formatDocument(res.json(data)));
  })

  /**
   * DELETE
   */
  app.delete('/api/:modelType/:_id', passport.authenticate('jwt', { session: false }), (req, res, next) => {
    const criteria = setCriteriaFromRequest(req);
    Promise.resolve(db.selectCollection('hookr', req.params.modelType))
      .then(coll => coll.remove(criteria))
      .then(doc => formatDocument(res.json(doc)));
  })
};
