'use strict';

/**
 * igbot-api compatibility surface for WONICA's local Instagram client.
 * Implementations delegate to WONICA's in-process methods; no RPC/hosted ICA
 * transport is used. Methods without a matching local implementation fail
 * explicitly instead of silently pretending to work.
 */
const IG_METHODS = [
  'addUserToGroup','changeAdminStatus','changeArchivedStatus','changeAvatar','changeBio',
  'changeBlockedStatus','changeGroupImage','changeNickname','changeNicknameSetting',
  'changeProfilePicture','clearChallenge','createNewGroup','createPoll','deleteMessage',
  'deleteThread','editMessage','follow','forwardAttachment','getAppState','getBotInfo',
  'getChallenge','getCurrentUserID','getEmojiUrl','getFriendsList','getIGUserInfo',
  'getListenerOptions','getMessage','getProfileInfo','getThreadData','getThreadHistory',
  'getThreadInfo','getThreadList','getThreadMedia','getThreadPictures','getUserID',
  'getUserInfo','handleFriendRequest','handleMessageRequest','isAvatarSupported',
  'isChallenged','listAvatarEffects','listEffects','logout','markAsDelivered','markAsRead',
  'markAsReadAll','markAsSeen','muteThread','refreshFb_dtsg','removeUserFromGroup',
  'resolvePhotoUrl','searchForThread','searchMusic','searchSessionTracking','sendAvatarEffect',
  'sendEffect','sendMessage','sendMusicSticker','sendTypingIndicator','setBio',
  'setListenerOptions','setMessageReaction','setTitle','threadColors','unfollow','unfriend',
  'unsendMessage','uploadAttachment','uploadGroupImage'
];

function withCallback(promise, callback) {
  if (typeof callback === 'function') {
    Promise.resolve(promise).then(v => callback(null, v), e => callback(e));
    return undefined;
  }
  return promise;
}

function attachIgBotCompatibility(api, client) {
  const unsupported = name => function (...args) {
    const callback = args.findLast?.(x => typeof x === 'function') || args.find(x => typeof x === 'function');
    const error = new Error(`${name} is part of the igbot-api compatibility list but has no equivalent local implementation in this WONICA build.`);
    if (callback) return callback(error);
    return Promise.reject(error);
  };

  const map = {
    getCurrentUserID: () => client.getCurrentUserID().userID,
    getUserInfo: (id, cb) => client.getUserInfo(id, cb),
    getUserID: (username, cb) => withCallback(client.getUserInfoByUsername(String(username).replace(/^@/, '')).then(u => u?.id || u?.pk || u?.userId || u), cb),
    getIGUserInfo: (id, cb) => client.getUserInfo(id, cb),
    getProfileInfo: (id, cb) => client.getUserInfo(id, cb),
    getThreadInfo: (id, cb) => client.getThreadInfo(id, cb),
    getThreadHistory: (id, amount, timestamp, cb) => client.getThreadHistory(id, amount, timestamp, cb),
    getThreadList: (limit, timestamp, tags, cb) => client.getInbox({ limit, timestamp, tags }, cb),
    searchForThread: (query, options, cb) => client.searchThreads(query, options, cb),
    deleteThread: (id, cb) => client.deleteThread(id, cb),
    muteThread: (id, cb) => client.muteThread(id, cb),
    setTitle: (id, title, cb) => client.changeThreadTitle(id, title, cb),
    changeNickname: (userID, threadID, nickname, cb) => client.changeNickname(userID, threadID, nickname, cb),
    addUserToGroup: (userIDs, threadID, cb) => client.threadManagement.addUsers(threadID, userIDs, cb),
    removeUserFromGroup: (userIDs, threadID, cb) => client.threadManagement.removeUsers(threadID, userIDs, cb),
    handleMessageRequest: (id, approve, cb) => (approve === false ? client.declineRequest(id, cb) : client.approveRequest(id, cb)),
    sendMessage: (message, threadID, cb) => client.sendMessage.toThread(threadID, message, cb),
    unsendMessage: (messageID, cb) => client.unsendMessage(messageID, cb),
    sendTypingIndicator: (threadID, isTyping, cb) => {
      if (typeof isTyping === 'function') { cb = isTyping; isTyping = true; }
      return isTyping === false ? client.stopTypingIndicator(threadID, cb) : client.sendTypingIndicator(threadID, cb);
    },
    setMessageReaction: (reaction, messageID, cb) => client.sendReaction(reaction, messageID, cb),
    markAsRead: (threadID, cb) => client.markAsRead(threadID, true, cb),
    markAsReadAll: cb => withCallback(client.getInbox({ limit: 100 }).then(async threads => {
      for (const t of (threads || [])) if (t.threadID || t.thread_id) await client.markAsRead(t.threadID || t.thread_id, true);
      return true;
    }), cb),
    searchMusic: (query, options, cb) => client.search.audio(query, options, cb),
    setListenerOptions: (options, cb) => { client.options = Object.assign(client.options || {}, options || {}); return withCallback(Promise.resolve(client.options), cb); },
    getListenerOptions: cb => withCallback(Promise.resolve(client.options || {}), cb),
    getAppState: cb => withCallback(Promise.resolve(client.getSession()), cb),
    logout: cb => client.logout(cb),
    getEmojiUrl: (emoji, size, ratio) => `https://emojiapi.dev/api/v1/${encodeURIComponent(emoji)}/画像?size=${size || 64}`,
    listEffects: () => [], listAvatarEffects: () => [], isAvatarSupported: () => false,
    threadColors: Object.freeze({})
  };

  for (const name of IG_METHODS) {
    if (typeof api[name] === 'function' && !map[name]) continue;
    api[name] = map[name] || unsupported(name);
  }

  // WONICA-native methods remain available alongside the compatibility names.
  api.getIGBotMethods = () => IG_METHODS.slice();
  api.getCompatibilityInfo = () => ({
    packageName: 'igbot-api',
    engine: 'WONICA local Instagram client',
    transport: 'direct in-process Instagram HTTP + MQTT',
    methods: IG_METHODS.slice(),
    unsupported: IG_METHODS.filter(name => !map[name])
  });
  return api;
}

module.exports = { attachIgBotCompatibility, IG_METHODS };
