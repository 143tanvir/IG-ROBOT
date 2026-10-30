# igbot-api

Local Instagram Direct API package built on the WONICA client engine, with an `igbot-api`-style compatibility surface for bot frameworks.

**No hosted ICA/RPC server is used.** Instagram HTTP requests, cookie/session handling and MQTT realtime connection run inside the Node.js process.

## Install

```bash
npm install igbot-api
```

Node.js 20 or newer is required.

## Login with cookies

```js
const { login } = require('igbot-api');

(async () => {
  const api = await login(process.env.IG_COOKIES, { logLevel: 'info' });
  api.listen((err, event) => {
    if (err) return console.error(err);
    console.log(event);
  });
  await api.sendMessage({ body: 'Hello from igbot-api' }, 'THREAD_ID');
})();
```

Cookie input accepts a cookie header string, Netscape cookie text, JSON, an array of cookie entries, or an object accepted by the cookie parser.

## Login with username/password and 2FA

```js
const { login } = require('igbot-api');

(async () => {
  try {
    const api = await login({ username: 'USERNAME', password: 'PASSWORD' });
    // If Instagram requires 2FA, login throws an error with:
    // err.twoFactorRequired, err.twoFactorIdentifier, and err.verify(code).
  } catch (error) {
    if (error.twoFactorRequired) {
      // Obtain the code through Instagram's normal verification flow.
      const api = await error.verify('123456');
    } else {
      console.error(error);
    }
  }
})();
```

The lower-level client also exposes `login`, `loginWithCookies`, `verifyTwoFactor`, `getSession`, `loadSession`, `logout`, and `destroy`.

## API methods

All WONICA-native methods remain available: messaging and media upload, replies, reactions, thread inbox/history/info, group management, read state, typing indicators, user lookup/search, stories, live features, MQTT listening, health, sessions, database and scheduler helpers.

The package also exposes the igbot-api method names (`getThreadList`, `getThreadInfo`, `getThreadHistory`, `sendMessage`, `sendTypingIndicator`, `setMessageReaction`, `getUserInfo`, `getUserID`, `searchMusic`, group/thread aliases, and the remaining compatibility names). Where a direct local equivalent exists, the compatibility method delegates to it. For names whose implementation was not present in the supplied igbot-api archive, the method is exposed but returns a clear “no equivalent local implementation” error; it does not fake a successful operation. Check the exact coverage at runtime:

```js
console.log(api.getCompatibilityInfo());
```

## Important source/implementation note

The supplied `igbot-api` ZIP contained method descriptors and hosted-server RPC transport/client code, not the Instagram engine implementations behind those RPC calls. This package therefore ports the available API surface and maps supported operations onto WONICA's local engine. It does not claim to have recreated unavailable server-side implementations. The `igbot-api` package identity does not imply affiliation with Instagram or Meta.

## License and credits

The original WONICA source license is retained in `LICENSE`. The compatibility layer is an integration layer authored for the `igbot-api` package. See the retained license and source headers for original project credits.
