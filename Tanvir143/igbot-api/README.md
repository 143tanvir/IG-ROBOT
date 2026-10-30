# igbot-api — Local + MQTT edition

This build replaces the hosted ICA RPC/WebSocket transport with an in-process Instagram client. HTTP requests, cookie/session handling and MQTT realtime run locally in the Node.js process. No `CHAT_API_URL`, `CHAT_API_KEY`, remote RPC server or remote event WebSocket is required.

## Requirements

- Node.js 18 or newer
- Install dependencies from this folder with `npm install`
- A valid Instagram session/appState or username/password

## Existing callback-style login

```js
const login = require('igbot-api');

login({ appState: require('./appstate.json') }, {
  listenMode: 'mqtt',       // MQTT realtime; use 'auto' for MQTT + polling fallback
  autoReconnect: true,
  skipUpdateCheck: true
}, (err, api) => {
  if (err) return console.error('Login failed:', err);

  api.listenMqtt((err, event) => {
    if (err) return console.error(err);
    if (event && event.type === 'message' && event.body === '.ping') {
      api.sendMessage('pong!', event.threadID);
    }
  });
});
```

Promise style:

```js
const login = require('igbot-api');
const api = await login({ appState: require('./appstate.json') }, { listenMode: 'mqtt' });
```

The appState format is the usual cookie array (`[{key,value,domain,path,...}]`). A saved native ICA session can also be supplied as `{session: require('./session.json')}`. Credential login is available through the bundled engine's normal options, e.g. `{username, password}`; do not commit credentials or session files.

## Local engine

The upstream `@alaminnna/ica-unofficial` 2.9.0 source is bundled under `lib/engine/` and retains its MIT license and upstream notices. Its MQTT listener handles reconnect/resume and event delivery. `listenMode: 'mqtt'` requests MQTT-only; `listenMode: 'auto'` permits polling fallback if MQTT cannot connect.

## Compatibility

The adapter keeps the callback login signature and common methods used by legacy bots: `sendMessage`, `listenMqtt`, `getThreadList`, `getThreadInfo`, `getThreadHistory`, `sendTypingIndicator`, `markAsRead`, `setMessageReaction`, `unsendMessage`, group membership helpers and profile lookup aliases. The bundled engine has a different feature surface; methods from the old remote manifest that have no equivalent locally are not magically available. Check the bundled engine README/API reference before using less common methods.

## Install / test

```bash
npm install
npm test
```

## Important

This uses Instagram's unofficial/private interfaces. Instagram may change them, require a fresh login/challenge, throttle requests, or restrict automated activity. Use cautiously and respect rate limits. Test with an account you control.
