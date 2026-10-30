'use strict';
// Local-only build. Kept as a compatibility module; no remote server settings.
function resolve(options) {
  return Object.assign({ timeoutMs: 30000, maxRetries: 2 }, options || {});
}
module.exports = { resolve, LOCAL_ENGINE: 'ica-unofficial' };
