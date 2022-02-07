# Solana NFT Tools

Collection of helper functions for interacting with Solana NFTs.

[![NPM](https://nodei.co/npm/@primenums/solana-nft-tools.png)](https://npmjs.org/package/@primenums/solana-nft-tools)

![NPM Package version](https://img.shields.io/npm/v/@primenums/solana-nft-tools)
![NPM Downloads](https://img.shields.io/npm/dw/@primenums/solana-nft-tools)


# Install

`npm i --save @primenums/solana-nft-tools`

# Examples

You can find these examples [here](./examples/index.js).

```JS
const NFTs = require('solana-nft-tools');
const web3 = require("@solana/web3.js");

(async () => {

  // Create connection
  const conn = new web3.Connection(
    web3.clusterApiUrl('mainnet-beta'),
    'confirmed'
  );

  // Get all mint tokens (NFTs) from your wallet
  const walletAddr = 'EaeLkUWHDXBRcLfvBXhczgavxPtCBASYYXB9rBrYN1b6';
  let mints = await NFTs.getMintTokensByOwner(conn, walletAddr);
  console.log('mints', mints);

  // Now we can get some NFT information (metadata)
  let myNFT = await NFTs.getNFTByMintAddress(conn, mints[0]);
  console.log('myNFT', myNFT);

  // Additional function to get all NFTs from wallet address
  let allMyNFTs = await NFTs.getNFTsByOwner(conn, walletAddr);
  console.log('allMyNFTs', allMyNFTs);

  // Be aware that some wallets may have too many NFTs, and Solana API may throw 429 Too many requests error.

  // Solana cluster rate limits:
  // https://docs.solana.com/cluster/rpc-endpoints#rate-limits-2

  // To handle this, you can first query all mint tokens, and then sequentially get NFT data for each.
  mints = await NFTs.getMintTokensByOwner(conn, walletAddr);
  myNFT = await NFTs.getNFTByMintAddress(conn, mints[0]);
  console.log('myNFT', myNFT);

  // Or use this function with pagination and caching
  let page = 1;
  const perPage = 10;
  const cacheTtlMins = 1; // Will keep the mint tokens cached for 1 minute
  let myNFTsPage1 = await NFTs.getNFTsByOwner(conn, walletAddr, page, perPage, cacheTtlMins);
  console.log('myNFTsPage1', myNFTsPage1);

  // the second page loads faster, if requested within cacheTtlMins
  page++;
  let myNFTsPage2 = await NFTs.getNFTsByOwner(conn, walletAddr, page, perPage, cacheTtlMins);
  console.log('myNFTsPage2', myNFTsPage2);

  page++;
  let myNFTsPage3 = await NFTs.getNFTsByOwner(conn, walletAddr, page, perPage, cacheTtlMins);
  console.log('myNFTsPage3', myNFTsPage3);
})();
```
