const db = require('./db');
const axios = require('axios');
const passport = require('passport');

module.exports = (app) => {
  const sendResponse = (res, hook) => {
    res.status(201).end();
    return hook;
  };

  const createRequest = (sub, req) => {
    const { url } = sub;
    const { headers, body } = req;
    headers['user-agent'] = 'hookr';
    headers['x-hookr-organization'] = sub.organization;
    headers['x-hookr-hook'] = sub.hook;
    headers['x-hookr-publisher'] = sub.publisher;
    delete headers['host'];
    delete headers['authorization'];

    process.stdout.write(`Dispatching hook ${sub.hook} to subscriber ${sub._id} via ${url}\n`);
    return axios.post(url, { headers, data: body })
      .then((res) => logSubscriptionSuccess(sub, headers, body, res))
      .catch(e => logSubscriptionFailure(sub, headers, body, e))
    ;
  };

  const logSubscriptionFailure = (subscription, requestHeaders, requestData, error) => {
    const { status, headers, data } = error.response;
    const payload = {
      date: new Date(),
      subscription: subscription._id + '',
      error: error.message,
      request: { headers: requestHeaders, data: requestData },
      response: { status, headers, data }
    }
    return Promise.resolve(db.getLogCollection())
      .then(coll => coll.insert(payload))
      .catch(e => process.stderr.write(e))
    ;
  }

  const logSubscriptionSuccess = (subscription, requestHeaders, requestData, response) => {
    const { status, headers, data } = response;
    const payload = {
      date: new Date(),
      subscription: subscription._id + '',
      request: { headers: requestHeaders, data: requestData },
      response: { status, headers, data }
    }
    return Promise.resolve(db.getLogCollection())
      .then(coll => coll.insert(payload))
      .catch(e => process.stderr.write(e))
    ;
  }

  const queueRequests = (cursor, req) => {
    const promises = [];
    cursor.forEach(sub => promises.push(createRequest(sub, req)));
    return promises;
  };

  const dispatchEvent = (req, hookModel) => {
    process.stderr.write(`\nDispatching hook ${hookModel._id} to subscribers!\n`);

    const { organization } = hookModel;
    const hook = hookModel._id + '';

    return Promise.resolve(db.getSubscriptionsCollection())
      .then(coll => coll.find({ organization, hook }))
      .then(cursor => queueRequests(cursor, req))
      .then(promises => Promise.all(promises));
  };

  app.post('/hook/:key', passport.authenticate('basic', { session: false }), (req, res, next) => {
    const publisher = req.user._id + '';
    const { organization } = req.user;
    const { key } = req.params;

    return Promise.resolve(db.getHookCollection())
      .then(coll => coll.findOne({ publisher, organization, key }))
      .then((hook) => {
        if (hook === null) {
          const err = new Error(`No hook is registered for organization "${organization}" with key "${key}".`);
          err.status = 404;
          throw err;
        }
        return hook;
      })
      .then(hook => sendResponse(res, hook))
      .then(hook => dispatchEvent(req, hook))
      .catch(e => next(e));
  });
};
