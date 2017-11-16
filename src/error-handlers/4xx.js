const Raven = require('raven');

module.exports = () => (err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  // Only handle 400 level errors.
  if (status < 400 || status > 499) {
    return next(err);
  }

  const eventId = Raven.captureException(err, { req });
  res.sentry = eventId;
  return next(err);
};
