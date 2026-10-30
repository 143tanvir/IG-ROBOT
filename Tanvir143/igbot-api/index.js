'use strict';

/**
 * igbot-api — local Instagram Direct adapter.
 * Keeps the legacy callback login/API surface while running the Instagram
 * HTTP + MQTT engine in this process. No hosted ICA RPC/WebSocket is used.
 * Upstream engine: @alaminnna/ica-unofficial (MIT); see LICENSE.ica-unofficial and lib/engine/.
 */
const engine = require('./lib/engine');
function normalizeAppState(input) {
  if (!input) return [];
  if (typeof input === 'string') return input.split(';').map(part => {
    const i = part.indexOf('=');
    return i > 0 ? { key: part.slice(0, i).trim(), value: part.slice(i + 1).trim(), domain: '.instagram.com', path: '/' } : null;
  }).filter(Boolean);
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.cookies)) return input.cookies;
  return [];
}
function looksLikeSession(input) {
  const cookies = normalizeAppState(input);
  return cookies.some(c => (c.key || c.name) === 'sessionid' && c.value) && cookies.some(c => (c.key || c.name) === 'ds_user_id' && c.value);
}

const CONSTANTS = Object.freeze({ API_VERSION: '2.0.0-local', ENGINE: 'ica-unofficial' });
const DEFAULT_METHODS = [
  'sendMessage','sendTypingIndicator','unsendMessage','editMessage','forwardAttachment',
  'uploadAttachment','uploadGroupImage','getThreadList','getThreadInfo','getThreadHistory',
  'getThreadPictures','getThreadMedia','getThreadData','getMessage','getUserInfo',
  'getIGUserInfo','getUserID','getCurrentUserID','getFriendsList','getBotInfo',
  'getProfileInfo','searchForThread','addUserToGroup','removeUserFromGroup',
  'changeAdminStatus','changeGroupImage','changeNickname','changeNicknameSetting',
  'createNewGroup','createPoll','deleteThread','deleteMessage','muteThread','setTitle',
  'setMessageReaction','markAsRead','markAsSeen','markAsDelivered','markAsReadAll',
  'handleMessageRequest','changeArchivedStatus','changeBlockedStatus','handleFriendRequest',
  'unfriend','follow','unfollow','searchMusic','sendMusicSticker','changeBio',
  'changeProfilePicture','getAppState','logout'
];

function nodeify(promise, cb) {
  if (typeof cb === 'function') {
    promise.then(value => cb(null, value), error => cb(error, null));
    return undefined;
  }
  return promise;
}

function asArray(value) { return Array.isArray(value) ? value : (value == null ? [] : [value]); }

function attachCompatibility(api) {
  api._userID = String(api.userId || api.userID || '');
  api.userID = api._userID;
  api.__localFollow = api.follow.bind(api);
  api.__localUnfollow = api.unfollow.bind(api);
  api.getCurrentUserID = cb => nodeify(Promise.resolve(String(api.userId || '')), cb);
  api.getUserID = (username, cb) => nodeify(api.getUserIdFromUsername(username), cb);
  const getUserInfoLocal = api.getUserInfo.bind(api);
  api.getUserInfo = (userId, cb) => nodeify(getUserInfoLocal(userId), cb);
  api.getIGUserInfo = api.getUserInfo;
  api.getProfileInfo = api.getUserInfo;
  api.getThreadList = (options, cb) => {
    if (typeof options === 'function') { cb = options; options = {}; }
    return nodeify(api.getThreads(options || {}), cb);
  };
  api.getInbox = api.getThreadList;
  api.getThreadInfo = (threadId, cb) => nodeify(api.getThread(threadId, { amount: 1 }), cb);
  api.getThreadHistory = (threadId, amount, cb) => {
    if (typeof amount === 'function') { cb = amount; amount = 20; }
    return nodeify(api.getMessages(threadId, { amount: amount || 20 }), cb);
  };
  api.getThreadData = api.getThreadInfo;
  api.sendTypingIndicator = (threadId, isTyping, cb) => {
    if (typeof isTyping === 'function') { cb = isTyping; isTyping = true; }
    return nodeify(api.setTyping(threadId, isTyping !== false), cb);
  };
  api.stopTypingIndicator = (threadId, cb) => nodeify(api.setTyping(threadId, false), cb);
  api.markAsRead = (threadId, cb) => nodeify(api.markThreadSeen(threadId), cb);
  api.markAsSeen = api.markAsRead;
  api.markAsReadAll = cb => nodeify(api.getThreads({ amount: 100 }).then(async rows => {
    for (const row of rows) await api.markThreadSeen(String(row.thread_id || row.threadId));
    return true;
  }), cb);
  api.setMessageReaction = (threadId, messageId, reaction, cb) => {
    if (threadId && typeof threadId === 'object') {
      const o = threadId;
      return nodeify(api.sendReaction(o.threadID || o.threadId, o.messageID || o.messageId, o.reaction || o.emoji), typeof messageId === 'function' ? messageId : cb);
    }
    return nodeify(api.sendReaction(threadId, messageId, reaction || '❤️'), cb);
  };
  api.deleteMessage = (threadId, messageId, cb) => nodeify(api.unsendMessage(threadId, messageId), cb);
  api.getAppState = cb => nodeify(Promise.resolve(api.getSession().cookieStore.cookies.map(c => ({ key: c.key, value: c.value, domain: c.domain, path: c.path, expires: c.expires }))), cb);
  api.getBotInfo = cb => nodeify(api.getCurrentUser(), cb);
  api.follow = (userId, cb) => nodeify(api.__localFollow({ userId }), cb);
  api.unfollow = (userId, cb) => nodeify(api.__localUnfollow({ userId }), cb);
  api.setTitle = (threadId, title, cb) => nodeify(api.updateThreadTitle(threadId, title), cb);
  api.addUserToGroup = (threadId, userIds, cb) => nodeify(api.addUsersToThread(threadId, asArray(userIds)), cb);
  api.addUserToThread = api.addUserToGroup;
  api.removeUserFromGroup = (threadId, userIds, cb) => nodeify(api.removeMember(threadId, asArray(userIds)), cb);
  api.removeUserFromThread = api.removeUserFromGroup;
  api.changeGroupImage = (threadId, image, cb) => nodeify(api.sendPhoto({ path: image, threadId }), cb);
  api.deleteThread = (threadId, cb) => nodeify(api.hideThread(threadId, false), cb);
  api.logoutCompat = cb => nodeify(api.logout(), cb);

  // Preserve the fca-style (err, event) callback expected by existing bots.
  const localListen = api.listen.bind(api);
  api.listenMqtt = (callback, options) => {
    if (typeof callback !== 'function') throw new TypeError('listenMqtt callback is required');
    api._stopListening = localListen(event => callback(null, event), Object.assign({ listenMode: 'mqtt', autoReconnect: true }, options || {}));
    return api._stopListening;
  };
  api.listen = api.listenMqtt;
  api.stopListening = () => { if (typeof api._stopListening === 'function') api._stopListening(); api.realtimeDisconnect(); };
  api.stopListeningAsync = async () => { api.stopListening(); return true; };
  api.getHealth = async () => ({ local: true, mqtt: !!(api._realtime && api._realtime.connected), userID: api.userID });
  return api;
}

function login(loginData, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  const opts = Object.assign({ skipUpdateCheck: true, autoUpdate: false }, options || {});
  const source = loginData || {};
  const input = source.session || source.cookies || source.appState || source.cookieString;
  if (!input && !(source.username || opts.username)) {
    const err = new Error('No local Instagram session supplied. Provide appState/cookies/session or username + password.');
    if (typeof callback === 'function') { callback(err, null); return; }
    return Promise.reject(err);
  }
  const engineOptions = !input ? {} : (input && input.cookieStore ? { session: input } :
    (typeof input === 'string' ? { cookieString: input } : { cookies: normalizeAppState(input) }));
  const run = engine.login(Object.assign({}, source, opts, engineOptions)).then(attachCompatibility);
  return nodeify(run, callback);
}

login.setOptions = () => {};
login.CONSTANTS = CONSTANTS;
login.methods = DEFAULT_METHODS;
login.utils = {
  normalizeAppState,
  looksLikeSession,
  getJar() {
    const cookies = {};
    return { cookies, setCookie(raw) { const pair = String(raw).split(';')[0]; const i = pair.indexOf('='); if (i > 0) cookies[pair.slice(0, i).trim()] = pair.slice(i + 1).trim(); }, getCookieString() { return Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; '); } };
  },
  makeDefaults() { return {}; },
  async checkLiveCookie(value) {
    const cookies = normalizeAppState(value);
    return cookies.some(c => (c.key || c.name) === 'sessionid' && c.value);
  }
};
login.login = login;
login.connect = login;
login.Api = engine.Client;
login.engine = engine;
module.exports = login;
module.exports.default = login;
module.exports.login = login;
module.exports.connect = login;
module.exports.utils = login.utils;
module.exports.CONSTANTS = CONSTANTS;
module.exports.Api = engine.Client;
