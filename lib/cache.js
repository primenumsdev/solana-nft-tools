/** Internal cache object, store results of some functions, that have @param {number} cacheTtl.
 * Cache items expire automatically after given TTL in minutes.
 */
const MEM_CACHE = {};
const MILLIS_PER_MIN = 60 * 1000;

/**
 * Add data to cache with a given ttl (minutes).
 * @param {string} key - Cache key.
 * @param {object} data - Data to cache.
 * @param {number} ttl - Time to live in minutes.
 */
function add (key, data, ttl) {
  MEM_CACHE[key] = data;
  // auto expire
  setTimeout(() => { 
    // console.log(`cacheKey ${key} expired`);
    delete MEM_CACHE[key]; 
  }, ttl * MILLIS_PER_MIN);
};
exports.add = add;

/**
 * Get data from cache by key.
 * @param {string} key - Cache key.
 */
function get (key) {
  const cached = MEM_CACHE[key];
  // if (cached) {
  //   console.log(`cacheKey ${key} found`);
  // }
  return cached;
};
exports.get = get;