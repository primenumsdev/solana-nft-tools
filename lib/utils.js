const { PublicKey } = require('@solana/web3.js');
const cache = require('./cache.js');

/**
 * Converts string to PublicKey
 * @param {string} key - Public key string.
 */
function toPublicKey (key) {
  if (typeof key !== "string") {
      return key;
  }

  const cacheKey = `pk-${key}`;
  let result = cache.get(cacheKey);
  if (!result) {
      result = new PublicKey(key);
      cache.add(cacheKey, result, 1);
  }
  return result;
};
exports.toPublicKey = toPublicKey;

