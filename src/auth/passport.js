const db = require('../db');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { GitHubStrategy } = require('./github-strategy');
const { BasicStrategy } = require('passport-http');
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');

const generateUserJWT = (accessToken, profile) => {
  const payload = {
    iss: 'hookr',
    sub: profile.id,
    profile
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d'});
  return token;
}

const getOrCreateUser = (accessToken, refreshToken, profile) => {
  const criteria = {
    _id: profile.id
  };
  return Promise.resolve(db.getUserCollection())
    .then(coll => coll.findOne(criteria))
    .then(user => {
      if (user === null) {
        const payload = Object.assign({}, profile);
        payload._id = payload.id;
        payload.accessToken = accessToken;
        payload.refreshToken = refreshToken;
        delete payload.id;
        return Promise.resolve(db.getUserCollection())
          .then(coll => coll.insert(payload))
          .then(() => payload)
        ;
      }
      return user;
    })
}

const updateUser = (user, token, profile) => {
  const { id } = user;
  const { orgs } = profile;
  return Promise.resolve(db.getUserCollection())
    .then(coll => coll.update({ id }, {$set: { token, orgs }}))
    .then(() => user)
  ;
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// Github (user) auth
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  (accessToken, refreshToken, profile, done) => {
    const token = generateUserJWT(accessToken, profile);
    return getOrCreateUser(accessToken, refreshToken, profile)
      .then(user => updateUser(user, token, profile))
      .then(user => {
        delete user.accessToken;
        delete user.refreshToken;
        return user;
      })
      .then(user => process.nextTick(() => done(null, user)))
    ;
  }
));

// Basic (Hook) auth
passport.use(new BasicStrategy((organization, apiKey, done) => {
  Promise.resolve(db.getPublisherCollection())
    .then(coll => coll.findOne({ organization, apiKey }))
    .then((doc) => {
      if (!doc) done(new Error('Invalid Credentials'));
      return done(null, doc, { scope: 'all' });
    });
  }
));

// Bearer (API) auth
const jwtOpts = {
  issuer: 'hookr',
  secretOrKey: process.env.JWT_SECRET,
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
};
passport.use(new JwtStrategy(jwtOpts, (payload, done) => {
  Promise.resolve(db.getUserCollection())
    .then(coll => coll.findOne({ _id: payload.sub }))
    .then((user) => done(null, user))
    .catch(e => done(e, false))
}))

module.exports = (app) => {
  app.use(passport.initialize());

  app.get('/auth/github/callback', passport.authenticate('github', { session: false }), (req, res) => {
    const profile = req.user;
    const { token } = profile;
    delete profile.token;
    const response = { token, profile };
    res.json(response);
  });

};
