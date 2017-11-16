const MongoDb = require('mongodb');
const Promise = require('bluebird');

Promise.promisifyAll(MongoDb);

const dsn = process.env.MONGO_DSN || 'mongodb://localhost:27017/hookr';

const state = {
  established: false,
  connection: null,
};

function getConnection() {
  if (state.established) {
    return state.connection;
  }
  throw new Error('Unable to obtain the database connection.');
}

function createConnectionPromise() {
  return MongoDb.MongoClient.connectAsync(dsn)
    .then((db) => {
      process.stdout.write(`Successful database connection to '${dsn}'\n\n`);
      return Object.create(null, {
        dsn: { value: dsn },
        db: { value: db },
      });
    });
}

function selectDb(dbName) {
  return getConnection().db(dbName);
}

function selectCollection(dbName, collName) {
  return selectDb(dbName).collection(collName);
}

function getHookrDb() {
  return selectDb('hookr');
}

function getPublisherCollection() {
  return getHookrDb().collection('publishers');
}

function getSubscriptionsCollection() {
  return getHookrDb().collection('subscriptions');
}

function getHookCollection() {
  return getHookrDb().collection('hooks');
}

function getEventCollection() {
  return getHookrDb().collection('events');
}

function getUserCollection() {
  return getHookrDb().collection('users');
}

function getLogCollection() {
  return getHookrDb().collection('logs');
}

function getObjectId(value) {
  return new MongoDb.ObjectID(value);
}

exports.getObjectId = getObjectId;
exports.getHookrDb = getHookrDb;
exports.getPublisherCollection = getPublisherCollection;
exports.getHookCollection = getHookCollection;
exports.getEventCollection = getEventCollection;
exports.getSubscriptionsCollection = getSubscriptionsCollection;
exports.getUserCollection = getUserCollection;
exports.getLogCollection = getLogCollection;

exports.selectCollection = selectCollection;

exports.connect = function connect() {
  if (state.established) {
    return Promise.resolve(state.connection);
  }

  return Promise.resolve(createConnectionPromise()).then((conn) => {
    state.established = true;
    state.connection = conn.db;
    return state.connection;
  });
};

