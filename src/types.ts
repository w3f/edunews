// Shared types for News Authenticity app

export interface Identity {
    display: string,
    address: string,
}

export type MultiSignature = string // Replace with actual type if available

export enum HashAlgo {
    SHA256 = 'Sha256',
    Blake2b256 = 'Blake2b256',
}

// Single canonical article type matching EduChain's ArticleRecord
export interface ArticleRecord {
    // Title of the article
    title: string;
    // Canonical URL of the article
    canonical_url: string;
    // AccountId of the publisher (author/owner)
    publisher: string;
    // NFT Collection linkage
    collection_id: number;
    // NFT Item linkage
    item_id: number;
    // Hash of this version's content
    content_hash: string;
    // Signature over the content hash
    signature: MultiSignature;
    // Hash algorithm used
    hash_algo: HashAlgo;
    // Word count of the article
    word_count: number;
    // Block number of last update for this version record
    last_updated_at: number;
    // Number of updates (anchor: 0, next version: 1, ...)
    updates: number;
}

export interface NewsPublisherCollection {
    collectionId: number;
    publisher: string;
    itemId?: number;
}
