const fetch = require('node-fetch');
const meta = require("./metadata.js");
const { toPublicKey } = require('./utils.js');
const { TOKEN_PROGRAM_ID } = require('./programs.js');
const cache = require('./cache.js');

// Solana JS Doc
// https://solana-labs.github.io/solana-web3.js/index.html

const COMMITMENT_CONFIRMED = 'confirmed';
const COMMITMENT_PROCESSED = 'processed';

/**
 * Get metadata for the given mint token.
 * @param {Connection} conn - Solana web3 connection.
 * @param {PublicKey} mintPubKey - Mint token public key.
 */
async function getMintTokenMeta (conn, mintPubKey) {
  // Solana stores NFTs metadata on a special address that is derived from a mint address
  // https://docs.solana.com/developing/programming-model/calling-between-programs#hash-based-generated-program-addresses
  const metaPubKey = await meta.getMetadataAccount(mintPubKey);

  // get meta account info
  const metaAcc = await conn.getAccountInfo(metaPubKey, COMMITMENT_CONFIRMED);

  // finally, decode metadata
  return meta.decodeMetadata(metaAcc.data);
};
exports.getMintTokenMeta = getMintTokenMeta;

/**
 * Get NFT by mint address.
 * @param {Connection} conn - Solana web3 connection.
 * @param {string} mintAddr - Mint token address.
 */
async function getNFTByMintAddress (conn, mintAddr) {
  const mintPubKey = toPublicKey(mintAddr);

  // Get the NFT meta
  const metaData = await getMintTokenMeta(conn, mintPubKey);

  // Get the NFT ID and owners
  // the account with amount 1 is a current owner
  // other are previous owners
  const largestAccs = await conn.getTokenLargestAccounts(mintPubKey, COMMITMENT_CONFIRMED);
  // also used as NFT ID
  const ownerAccPubKey = largestAccs.value.filter(v => v.amount === '1')[0].address;
  const ownerAcc = await conn.getParsedAccountInfo(ownerAccPubKey, COMMITMENT_CONFIRMED);

  let res = {
    id: ownerAccPubKey.toBase58(),
    mint: metaData.mint,
    owner: ownerAcc.value.data.parsed.info.owner,
    ...metaData.data
  };

  if (res.uri) {
    const info = await fetch(res.uri).then(r => r.json());
    res = {...res, ...info};
  }

  return res;
};
exports.getNFTByMintAddress = getNFTByMintAddress;

/**
 * Get mint tokens owned by wallet address.
 * Returns array of strings.
 * Be aware, some wallets may have too many tokens.
 * @param {Connection} conn - Solana web3 connection.
 * @param {string} walletAddr - Wallet address.
 * @param {number} cacheTtlMins - Cache TTL, minutes.
 */
async function getMintTokensByOwner (conn, walletAddr, cacheTtlMins = null) {
  const cacheKey = `getMintTokensByOwner-${walletAddr}`;
  let tokens = cache.get(cacheKey);
  if (tokens) {
    return tokens;
  }

  const tokenAccs = await conn.getParsedTokenAccountsByOwner(
    toPublicKey(walletAddr),
    { programId: toPublicKey(TOKEN_PROGRAM_ID) },
    COMMITMENT_PROCESSED
  );

  tokens = tokenAccs.value.map(t => t.account.data.parsed.info.mint);

  if (cacheTtlMins) {
    cache.add(cacheKey, tokens, cacheTtlMins);
  }

  return tokens;
};
exports.getMintTokensByOwner = getMintTokensByOwner;

/**
 * Get NFTs owned by wallet address.
 * Returns array of NFT objects.
 * Be aware, some wallets may have too many tokens.
 * Use page and size params to iterate over big collections.
 * @param {Connection} conn - Solana web3 connection.
 * @param {string} walletAddr - Wallet address.
 * @param {number} page - Page number, default 1.
 * @param {number} size - Items per page, default 10.
 * @param {number} cacheTtlMins - Cache TTL, minutes.
 */
async function getNFTsByOwner (conn, walletAddr, page = 1, size = 10, cacheTtlMins = null) {
  const tokens = await getMintTokensByOwner(conn, walletAddr, cacheTtlMins);

  // get nft metadata
  const start = (page - 1) * size;
  const end = start + size;
  // load NFT metadata concurrently, some size options may cause 429 Too many requests error.
  // TODO: Use batch request
  const nfts = await Promise.all(tokens.slice(start, end).map(t => getNFTByMintAddress(conn, t)));

  return nfts;
};
exports.getNFTsByOwner = getNFTsByOwner;
