const { BinaryReader, BinaryWriter, deserializeUnchecked } = require('borsh');
const { PublicKey } = require('@solana/web3.js');
const base58 = require('bs58');
const { METADATA_PROGRAM_ID } = require('./programs.js');

const METADATA_PREFIX = "metadata";

const PubKeysInternedMap = new Map();

BinaryReader.prototype.readPubkey = function () {
    var reader = this;
    var array = reader.readFixedArray(32);
    return new PublicKey(array);
};
BinaryWriter.prototype.writePubkey = function (value) {
    var writer = this;
    writer.writeFixedArray(value.toBuffer());
};
BinaryReader.prototype.readPubkeyAsString = function () {
    var reader = this;
    var array = reader.readFixedArray(32);
    return base58.encode(array);
};
BinaryWriter.prototype.writePubkeyAsString = function (value) {
    var writer = this;
    writer.writeFixedArray(base58.decode(value));
};

const toPublicKey = function (key) {
    if (typeof key !== "string") {
        return key;
    }
    var result = PubKeysInternedMap.get(key);
    if (!result) {
        result = new PublicKey(key);
        PubKeysInternedMap.set(key, result);
    }
    return result;
};


// enum
const MetadataKey = {
    Uninitialized: 0,
    MetadataV1: 4,
    EditionV1: 1,
    MasterEditionV1: 2,
    MasterEditionV2: 6,
    EditionMarker: 7,
    };

// types for Borsch
function Creator(args) {
    this.address = args.address;
    this.verified = args.verified;
    this.share = args.share;
}

function Data(args) {
    this.name = args.name;
    this.symbol = args.symbol;
    this.uri = args.uri;
    this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
    this.creators = args.creators;
}

function Metadata(args) {
    this.key = MetadataKey.MetadataV1;
    this.updateAuthority = args.updateAuthority;
    this.mint = args.mint;
    this.data = args.data;
    this.primarySaleHappened = args.primarySaleHappened;
    this.isMutable = args.isMutable;
    this.editionNonce = args.editionNonce;
}

var METADATA_SCHEMA = new Map([
    [
        Data,
        {
            kind: "struct",
            fields: [
                ["name", "string"],
                ["symbol", "string"],
                ["uri", "string"],
                ["sellerFeeBasisPoints", "u16"],
                ["creators", { kind: "option", type: [Creator] }],
            ]
        },
    ],
    [
        Creator,
        {
            kind: "struct",
            fields: [
                ["address", "pubkeyAsString"],
                ["verified", "u8"],
                ["share", "u8"],
            ]
        },
    ],
    [
        Metadata,
        {
            kind: "struct",
            fields: [
                ["key", "u8"],
                ["updateAuthority", "pubkeyAsString"],
                ["mint", "pubkeyAsString"],
                ["data", Data],
                ["primarySaleHappened", "u8"],
                ["isMutable", "u8"], // bool
            ]
        },
    ],
]);

const getMetadataAccount = async (mintPubKey) => {
    const seeds = [
        Buffer.from(METADATA_PREFIX),
        toPublicKey(METADATA_PROGRAM_ID).toBuffer(),
        mintPubKey.toBuffer(),
    ];
    const result = await PublicKey.findProgramAddress(seeds, toPublicKey(METADATA_PROGRAM_ID));
    // TODO: describe the result
    return result[0];
};

var METADATA_REPLACE = new RegExp("\u0000", "g");

const decodeMetadata = function (buffer) {
    const metadata = deserializeUnchecked(
        METADATA_SCHEMA,
        Metadata,
        buffer
      );
    
      metadata.data.name = metadata.data.name.replace(METADATA_REPLACE, "");
      metadata.data.uri = metadata.data.uri.replace(METADATA_REPLACE, "");
      metadata.data.symbol = metadata.data.symbol.replace(METADATA_REPLACE, "");
      return metadata;
};


exports.getMetadataAccount = getMetadataAccount;
exports.decodeMetadata = decodeMetadata;
