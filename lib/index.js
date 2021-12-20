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
  if (metaAcc === null) {
    return null;
  }

  // finally, decode metadata
  return meta.decodeMetadata(metaAcc.data);
};
exports.getMintTokenMeta = getMintTokenMeta;

/**
 * Get mint token owner.
 * @param {Connection} conn - Solana web3 connection.
 * @param {PublicKey} mintPubKey - Mint token public key.
 */
async function getMintTokenOwner (conn, mintPubKey) {
  // Get the NFT ID and owners
  // the account with amount 1 is a current owner
  // other are previous owners
  let largestAccs = [];
  try {
    largestAccs = await conn.getTokenLargestAccounts(mintPubKey, COMMITMENT_CONFIRMED);
  } catch (err) {
    return {
      error: err.message
    };
  }
  // NFT mint address should have amount 1 and it should be total supply
  const largesrAccWithAmt1 = largestAccs.value.filter(v => v.amount === '1');
  if (largesrAccWithAmt1.length === 0) {
    return {
      error: 'Mint address is not NFT.'
    };
  }
  // also used as NFT ID in Phantom wallet
  const ownerAccPubKey = largesrAccWithAmt1[0].address;
  const ownerAcc = await conn.getParsedAccountInfo(ownerAccPubKey, COMMITMENT_CONFIRMED);

  return {
    id: ownerAccPubKey.toBase58(),
    owner: ownerAcc.value.data.parsed.info.owner
  };
};
exports.getMintTokenOwner = getMintTokenOwner;

/**
 * Map NFT object.
 * @param {string} id - Owner account public key string.
 * @param {string} owner - Owner public key string.
 * @param {object} metaData - Metadata associated with NFT.
 */
async function toNFT(id, owner, metaData) {
  let res = {
    id,
    owner,
    mint: metaData.mint,
    ...metaData.data
  };

  if (res.uri) {
    const info = await fetch(res.uri).then(r => r.json());
    res = {...res, ...info};
  }

  return res;
};
exports.toNFT = toNFT;

/**
 * Get NFT by mint address.
 * @param {Connection} conn - Solana web3 connection.
 * @param {string} mintAddr - Mint token address.
 */
async function getNFTByMintAddress (conn, mintAddr) {
  const mintPubKey = toPublicKey(mintAddr);

  const [metaData, { id, owner, error }] = await Promise.all([
    getMintTokenMeta(conn, mintPubKey),
    getMintTokenOwner(conn, mintPubKey)
  ]);

  if (metaData === null || error) {
    return { 
      mint: mintAddr,
      error: error || 'Failed to parse metadata.'
    };
  }
  const res = await toNFT(id, owner, metaData);
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

  // Always pagination to protect from too large requests that may be rejected by Solana.
  // Using batch requests to make sure we not exceed Solana cluster rate limits
  // https://docs.solana.com/cluster/rpc-endpoints#rate-limits-2
  const start = (page - 1) * size;
  const end = start + size;
  const mints = tokens.slice(start, end);

  if (!mints.length) {
    return [];
  }

  if (mints.length === 1) {
    return [
      await getNFTByMintAddress(conn, mints[0])
    ];
  }
  
  const mintsHash = {};

  const toMetaBatchKey = mint => `meta-${mint}`;
  const toLargestAccBatchKey = mint => `largest-${mint}`;
  const toOwnerBatchKey = mint => `owner-${mint}`;

  // get meta pub keys
  let meatPubKeyPromises = [];
  for (const mint of mints) {
    meatPubKeyPromises.push(
      meta.getMetadataAccount(toPublicKey(mint))
        .then(metaPubKey => mintsHash[mint] = { metaPubKey })
    );
  }

  await Promise.all(meatPubKeyPromises);

  // in first batch we request meta accounts, and largest token accounts
  let batchBody1 = [];
  for (const mint of mints) {
    const metaPubKey = mintsHash[mint]['metaPubKey'];
    const metaBatchResKey = toMetaBatchKey(mint);
    const largestAccsBatchResKey = toLargestAccBatchKey(mint);
    // store items in hash by mint key, to access them later
    mintsHash[mint] = {
      metaBatchResKey,
      largestAccsBatchResKey
    };
    // meta acc info
    batchBody1.push(
      toAPIRequest(
        metaBatchResKey,
        'getAccountInfo',
        [metaPubKey.toBase58(), { 'encoding': 'base64' }]
      )
    );
    // largest accs
    batchBody1.push(
      toAPIRequest(
        largestAccsBatchResKey,
        'getTokenLargestAccounts',
        [mint]
      )
    );
  }
  const batchRes1 = await rawAPIRequest(conn, batchBody1);

  // in second batch we need to use the results of first batch to get owner account address
  let batchBody2 = [];
  for (const mint of mints) {
    // find meta
    const metaAcc = batchRes1.filter(r => r.id === mintsHash[mint].metaBatchResKey)[0].result.value;
    mintsHash[mint]['metadata'] = meta.decodeMetadata(Buffer.from(metaAcc.data[0], 'base64'));

    // find largest acc to make another batch
    const largestAccs = batchRes1.filter(r => r.id === mintsHash[mint].largestAccsBatchResKey)[0].result.value;
    const ownerAccAddr = largestAccs.filter(v => v.amount === '1')[0].address;
    const ownerBatchResKey = toOwnerBatchKey(mint);
    mintsHash[mint]['ownerBatchResKey'] = ownerBatchResKey;
    mintsHash[mint]['ownerAccAddr'] = ownerAccAddr;
    batchBody2.push(
      toAPIRequest(
        ownerBatchResKey, 
        'getAccountInfo', 
        [ownerAccAddr, {'encoding': 'jsonParsed'}]
      )
    );
  }
  const batchRes2 = await rawAPIRequest(conn, batchBody2);

  // finally compose all the data and map NFTs
  let resPromises = [];
  for (const mint of mints) {
    const ownerAcc = batchRes2.filter(r => r.id === mintsHash[mint].ownerBatchResKey)[0].result.value;
    resPromises.push(
      toNFT(
        mintsHash[mint]['ownerAccAddr'],
        ownerAcc.data.parsed.info.owner,
        mintsHash[mint]['metadata'])
    );
  }

  const res = await Promise.all(resPromises);

  return res;
};
exports.getNFTsByOwner = getNFTsByOwner;

/**
 * Map raw API request to Solana cluster.
 * @param {string} id - Unique ID of a given request body, used to find result in batch response.
 * @param {string} method - RPC method name.
 * @param {object} params - Array of RPC method params.
 */
function toAPIRequest (id, method, params) {
  return {
    "jsonrpc": "2.0",
    "id": id,
    "method": method,
    "params": params
  };
};

/**
 * Make raw API request to Solana cluster.
 * @param {Connection} conn - Solana web3 connection.
 * @param {object} body - Body parameters for RPC API call.
 */
async function rawAPIRequest (conn, body) {
  const res = await fetch(conn._rpcEndpoint, {
    method: 'post',
    body: JSON.stringify(body),
    headers: {'Content-Type': 'application/json'}
  })
  .then(r => r.json());

  return res;
};
exports.rawAPIRequest = rawAPIRequest;
