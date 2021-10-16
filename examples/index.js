const NFTs = require('../lib');
const web3 = require("@solana/web3.js");

(async () => {
  // Connect to Solana
  const conn = new web3.Connection(
    web3.clusterApiUrl('mainnet-beta'),
    'confirmed'
  );

  // This is your NFT mint address
  // const mintAddr = "8jbcPTiZEU42XVYpkx1XLDgRPXyMy9HiN3KTtpFq1uPX";
  
  // const myNFT = await NFTs.getNFTByMintAddress(conn, mintAddr);
  // console.log('myNFT', JSON.stringify(myNFT, null, 2));

  // Get all NFTs in your wallet
  // This wallet has 80k NFTs
  // const walletAddr = 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp';
  // const mints = await NFTs.getMintTokensByOwner(conn, walletAddr);
  // console.log('tota mints', mints.length);

  // "HfaFdRYzfzyf1RaZo48ueDJSe2oP44Sm6nid24n3Awf",
  // "6TNBbACaSBwDXCwrEfS73u2ebTyfC23PAcwaXc7o7Lax",
  // "BQ55YZoCuDb8yVu9aRnm8VXK4Ao1WNYLXZDw1NRQzavT",
  // "EfDGMigJ3UbKGf3VCwToURqfsZFhCkKYeJjZ7WWfAdsU",
  // const someNft = await NFTs.getNFTByMintAddress(conn, 'EfDGMigJ3UbKGf3VCwToURqfsZFhCkKYeJjZ7WWfAdsU');
  // console.log('someNft', someNft);


  // Can do paginated NFTs retrieval
  const page1 = await NFTs.getNFTsByOwner(conn, 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp', 1, 1, 0.5);
  console.log('page 1', page1);
  const page2 = await NFTs.getNFTsByOwner(conn, 'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMHTTVvtncGgp', 2, 1, 0.5);
  console.log('page 2', page2);
})();