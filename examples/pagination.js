const NFTs = require('../lib');
const web3 = require("@solana/web3.js");

(async () => {
  const conn = new web3.Connection(
    web3.clusterApiUrl('mainnet-beta'),
    'confirmed'
  );

  // Wallet has 80k NFTs
  const walletAddr = 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp';

  // Use this function with pagination and caching
  let page = 1;
  const perPage = 10;
  const cacheTtlMins = 1; // Will keep the mint tokens cached for 6 seconds
  let myNFTsPage1 = await NFTs.getNFTsByOwner(conn, walletAddr, page, perPage, cacheTtlMins);
  console.log('myNFTsPage1', myNFTsPage1);

  // the second page loads faster, if requested within cacheTtlMins
  page++;
  let myNFTsPage2 = await NFTs.getNFTsByOwner(conn, walletAddr, page, perPage, cacheTtlMins);
  console.log('myNFTsPage2', myNFTsPage2);

  page++;
  let myNFTsPage3 = await NFTs.getNFTsByOwner(conn, walletAddr, page, perPage, cacheTtlMins);
  console.log('myNFTsPage3', myNFTsPage3);

})()