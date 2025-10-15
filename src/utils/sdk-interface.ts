// Simplified imports using only the types from types.ts
import type {
  Identity,
  ArticleRecord,
  NewsPublisherCollection,
} from '~/types'
import { HashAlgo } from '~/types'
import { Binary, type TypedApi } from 'polkadot-api'
import { MultiAddress, MultiSignature, type Pas_asset_hub } from '~/descriptors/dist'
import { FixedSizeBinary } from 'polkadot-api'
import { connectInjectedExtension } from 'polkadot-api/pjs-signer'
import { connectedWallet, selectedAccount } from '~/composables/useConnect'
import sdk from '~/utils/sdk'
import { unifyAddress } from './formatters'

// Get Polkadot signer for current selected account
export async function polkadotSigner() {
  const selectedExtension = await connectInjectedExtension(
    connectedWallet.value?.extensionName || '',
  )
  const account = selectedExtension.getAccounts().find(
    account => unifyAddress(account.address) === unifyAddress(selectedAccount.value?.address || '')
  )
  return account?.polkadotSigner
}

// Get identity info from PeopleHub
export async function getIdentityFromAddress(address: string): Promise<Identity | undefined> {
  const unified = unifyAddress(address)
  const fetchedIdentity = await sdk('pas_people_hub').api.query.Identity.IdentityOf.getValue(unified)
  const codedBinaryDisplay = fetchedIdentity?.info.display.value as FixedSizeBinary<32> | undefined
  return fetchedIdentity ? {
    display: codedBinaryDisplay?.asText() || '',
    address: unified
  } : undefined
}


// Canonical: Fetch all articles from EduChain
export async function getAllDisplayArticles(): Promise<ArticleRecord[]> {
  const educhainApi = sdk('educhain').api
  const entries = await educhainApi.query.News.ArticleByHash.getEntries()
  return entries.map(entry => {
    const data = entry.value
    return {
      title: data.title?.asText?.() || '',
      canonical_url: data.canonical_url?.asText?.() || '',
      publisher: data.publisher?.toString?.() || '',
      collection_id: Number(data.collection_id),
      item_id: Number(data.item_id),
      content_hash: data.content_hash?.asHex?.() || '',
      signature: data.signature?.value?.asHex?.() || '',
      hash_algo: data.hash_algo?.type as HashAlgo || HashAlgo.Blake2b256,
      word_count: Number(data.word_count),
      last_updated_at: Number(data.last_updated_at) || 0,
      updates: Number(data.updates) || 0,
    } as ArticleRecord
  })
}

// Get all news publisher collections (only those starting with 'news')
export async function getAllNewsPublisherCollections(): Promise<NewsPublisherCollection[]> {
  const allMetadatas = await sdk('pas_asset_hub').api.query.Nfts.CollectionMetadataOf.getEntries()
  console.log(allMetadatas)
  const filteredMetadatas: number[] = allMetadatas.filter((entry) => {
    const metadataRaw = entry.value.data.asText()
    return metadataRaw.startsWith('news')
  }).map((entry) => entry.keyArgs[0] as number)

  const collectionKeys: [number][] = filteredMetadatas.map(id => [id])
  const collectionsWithOwners: NewsPublisherCollection[] = (await sdk('pas_asset_hub').api.query.Nfts.Collection.getValues(collectionKeys)).map((collection, idx) => ({
    collectionId: collectionKeys[idx][0],
    publisher: unifyAddress(collection?.owner.toString() || '')
  }))
  return collectionsWithOwners
}

// Get the owner of an NFT on AssetHub
export async function getNftOwner(collectionId: number, itemId: number): Promise<string | undefined> {
  try {
    const assetApi = sdk('pas_asset_hub').api
    const item = await assetApi.query.Nfts.Item.getValue(collectionId, itemId)
    if (item && item.owner) {
      return unifyAddress(item.owner.toString())
    }
    return undefined
  } catch (error) {
    console.error('Error getting NFT owner:', error)
    return undefined
  }
}

// Get next available item ID for a collection
export async function getNextItemId(collectionId: number): Promise<number> {
  const items = await sdk('pas_asset_hub').api.query.Nfts.ItemMetadataOf.getEntries(collectionId)
  const itemIds = items.map(entry => entry.keyArgs[1] as number)
  return itemIds.length ? Math.max(...itemIds) + 1 : 1
}

// Check if an NFT exists on AssetHub by collection_id and item_id
export async function checkNftExists(collectionId: number, itemId: number, hash: string): Promise<boolean> {
  try {
    const assetApi = sdk('pas_asset_hub').api
    const metadatas = await assetApi.query.Nfts.ItemMetadataOf.getEntries(collectionId)
    console.log(metadatas)
    const item = await assetApi.query.Nfts.Item.getValue(collectionId, itemId)
    if (item) {
      const metadata = await assetApi.query.Nfts.ItemMetadataOf.getValue(collectionId, itemId)
      if (metadata) {
        return metadata.data.asText() === hash
      } else {
        return false
      }
    } else {
      return false
    }
  } catch (error) {
    console.error('Error checking NFT existence:', error)
    return false
  }
}

export function createCollectionTx(assetApi: any, publisherAddress: string) {
  return assetApi.tx.Nfts.create({
    admin: MultiAddress.Id(publisherAddress),
    config: {
      settings: BigInt(0),
      mint_settings: {
        mint_type: { type: "Public", value: undefined },
        default_item_settings: BigInt(0),
        price: undefined,
        start_block: undefined,
        end_block: undefined
      },
      max_supply: undefined
    },
  })
}

// Helper to create a mint NFT transaction on AssetHub
export function createMintNftTx(assetApi: TypedApi<Pas_asset_hub>, collectionId: number, itemId: number, ownerAddress: string) {
  return assetApi.tx.Nfts.mint({
    collection: collectionId,
    item: itemId,
    mint_to: MultiAddress.Id(ownerAddress),
    witness_data: undefined
  })
}

// Helper to create a set NFT metadata transaction on AssetHub
export function createSetMetadataTx(assetApi: TypedApi<Pas_asset_hub>, collectionId: number, itemId: number, anchor_hash: string) {
  return assetApi.tx.Nfts.set_metadata({
    collection: collectionId,
    item: itemId,
    data: Binary.fromText(anchor_hash),
  })
}

// Helper to create set collection metadata transaction
export function createSetCollectionMetadataTx(assetApi: TypedApi<Pas_asset_hub>, collectionId: number) {
  return assetApi.tx.Nfts.set_collection_metadata({
    collection: collectionId,
    data: Binary.fromText('news')
  })
}

/**
 * Legacy function: Create NFT for an already-registered article
 * 
 * NOTE: This function is maintained for backward compatibility.
 * The recommended approach is to use recordArticleDirectlyOnEduChain which creates
 * the NFT first, then records on EduChain.
 * 
 * - Uses the item ID from EduChain registration
 * - Mints NFT and sets metadata on AssetHub
 * - Returns success status and the item ID
 * - Note: Collection must already exist before calling this function
 */
export async function createNftForRegisteredArticle(
  collectionId: number,
  publisherAddress: string,
  eduChainItemId: number,
  contentHash: string
): Promise<{ success: boolean, itemId?: number, collectionId?: number }> {
  console.log(`LEGACY FUNCTION: Using createNftForRegisteredArticle. Consider using recordArticleDirectlyOnEduChain instead.`);
  const assetApi = sdk('pas_asset_hub').api
  const signer = await polkadotSigner()
  if (!signer) throw new Error('No signer found')

  try {
    const unified = unifyAddress(publisherAddress);

    // Check if collection exists
    const collections = await getAllNewsPublisherCollections();
    const collectionExists = collections.some(c => c.collectionId === collectionId);

    if (!collectionExists) {
      console.error(`Collection ${collectionId} doesn't exist. Please use recordArticleDirectlyOnEduChain for new collections.`);
      return { success: false };
    }

    // Use the provided eduChainItemId directly
    console.log(`Creating NFT with collection ID ${collectionId}, item ID ${eduChainItemId}`);

    // Batch mint and set NFT metadata
    const mintTx = createMintNftTx(assetApi, collectionId, eduChainItemId, unified);
    const itemMetadataTx = createSetMetadataTx(assetApi, collectionId, eduChainItemId, contentHash);
    const batchCalls = [mintTx.decodedCall, itemMetadataTx.decodedCall];
    const batchTx = assetApi.tx.Utility.batch({ calls: batchCalls });

    // Return a Promise that resolves when the transaction is finalized
    return new Promise((resolve) => {
      batchTx.signSubmitAndWatch(signer).subscribe({
        next(event) {
          if (event.type === 'finalized') {
            console.log(`NFT created successfully: collection ${collectionId}, item ${eduChainItemId}`);
            resolve({
              success: true,
              itemId: eduChainItemId,
              collectionId: collectionId
            });
          }
        },
        error(e) {
          console.error('Error creating NFT for registered article:', e);
          resolve({ success: false });
        }
      });
    });
  } catch (error) {
    console.error('Error creating NFT for registered article:', error);
    return { success: false };
  }
}

/**
 * Updated flow: Batch all AssetHub operations, then record on EduChain.
 * This reduces signatures from 3-4 down to 2.
 * 
 * Signature count:
 * - First article (new collection): 2 signatures
 *   1. AssetHub batch: create collection + set collection metadata + mint NFT + set NFT metadata
 *   2. EduChain: record article
 * 
 * - Subsequent articles: 2 signatures
 *   1. AssetHub batch: mint NFT + set NFT metadata
 *   2. EduChain: record article
 */
export async function recordArticleDirectlyOnEduChain(
  title: string,
  canonicalUrl: string,
  publisherAddress: string,
  contentHash: string,
  signature: string,
  hashAlgo: HashAlgo,
  wordCount: number
): Promise<{ collectionId: number, itemId: number, nftCreated: boolean }> {
  const unified = unifyAddress(publisherAddress);
  console.log(`Starting article verification process for publisher: ${unified}`);

  // Check if publisher already has a collection
  const collections = await getAllNewsPublisherCollections();
  const existingCollection = collections.find(c => c.publisher === unified);

  const assetApi = sdk('pas_asset_hub').api;
  const eduChainApi = sdk('educhain').api;
  const signer = await polkadotSigner();
  if (!signer) throw new Error('No signer found');

  let collectionId: number;
  let itemId: number;

  try {
    if (existingCollection) {
      // Path 1: Existing collection - batch mint + metadata (2 total signatures)
      collectionId = existingCollection.collectionId;
      itemId = await getNextItemId(collectionId);
      console.log(`Using existing collection ${collectionId}, minting item ${itemId}`);

      // Batch: mint NFT + set NFT metadata
      const mintTx = createMintNftTx(assetApi, collectionId, itemId, unified);
      const itemMetadataTx = createSetMetadataTx(assetApi, collectionId, itemId, contentHash);
      const batchTx = assetApi.tx.Utility.batch_all({
        calls: [mintTx.decodedCall, itemMetadataTx.decodedCall]
      });

      console.log(`Step 1: Batching mint + metadata on AssetHub (1 signature)`);
      await new Promise<void>((resolve, reject) => {
        batchTx.signSubmitAndWatch(signer).subscribe({
          next(event) {
            if (event.type === 'finalized') {
              console.log(`✓ NFT minted and metadata set: collection ${collectionId}, item ${itemId}`);
              resolve();
            }
          },
          error(e) {
            console.error('Error in batched NFT creation:', e);
            reject(e);
          }
        });
      });

    } else {
      // Path 2: New collection - batch all 4 operations (2 total signatures)
      collectionId = await assetApi.query.Nfts.NextCollectionId.getValue() || 0;
      itemId = 1; // First item in new collection
      console.log(`Creating new collection ${collectionId} with first item ${itemId}`);

      // Batch: create collection + set collection metadata + mint NFT + set NFT metadata
      const createTx = createCollectionTx(assetApi, unified);
      const collectionMetadataTx = createSetCollectionMetadataTx(assetApi, collectionId);
      const mintTx = createMintNftTx(assetApi, collectionId, itemId, unified);
      const itemMetadataTx = createSetMetadataTx(assetApi, collectionId, itemId, contentHash);

      const batchTx = assetApi.tx.Utility.batch_all({
        calls: [
          createTx.decodedCall,
          collectionMetadataTx.decodedCall,
          mintTx.decodedCall,
          itemMetadataTx.decodedCall
        ]
      });

      console.log(`Step 1: Batching collection creation + metadata + mint + item metadata (1 signature)`);
      await new Promise<void>((resolve, reject) => {
        batchTx.signSubmitAndWatch(signer).subscribe({
          next(event) {
            if (event.type === 'finalized') {
              console.log(`✓ Collection created and NFT minted: collection ${collectionId}, item ${itemId}`);
              resolve();
            }
          },
          error(e) {
            console.error('Error in batched collection + NFT creation:', e);
            reject(e);
          }
        });
      });
    }

    // Step 2: Record article on EduChain (second signature)
    console.log(`Step 2: Recording article on EduChain (1 signature)`);
    const tx = eduChainApi.tx.News.record_article({
      collection_id: BigInt(collectionId),
      item_id: BigInt(itemId),
      content_hash: Binary.fromHex(contentHash),
      signature: MultiSignature.Sr25519(Binary.fromHex(signature)),
      hash_algo: { type: hashAlgo, value: undefined },
      word_count: wordCount,
      title: Binary.fromText(title),
      canonical_url: Binary.fromText(canonicalUrl),
    });

    return new Promise((resolve, reject) => {
      tx.signSubmitAndWatch(signer).subscribe({
        next(event) {
          if (event.type === 'finalized') {
            console.log(`✓ Article recorded on EduChain: collection ${collectionId}, item ${itemId}`);
            console.log(`🎉 Complete! Total signatures: 2`);
            resolve({ collectionId, itemId, nftCreated: true });
          }
        },
        error(e) {
          console.error('Error recording article on EduChain:', e);
          reject(e);
        }
      });
    });
  } catch (error) {
    console.error('Error in article verification process:', error);
    throw error;
  }
}

/**
 * Legacy function: Record article on EduChain after NFT is minted.
 * 
 * NOTE: This function is maintained for backward compatibility.
 * The recommended approach is to use recordArticleDirectlyOnEduChain which creates
 * the NFT first, then records on EduChain in one cohesive flow.
 * 
 * - Registers the article on EduChain.
 * - Should be called after NFT is minted.
 */
export async function recordArticleOnEduChain(
  title: string,
  canonicalUrl: string,
  collectionId: number,
  itemId: number,
  contentHash: string,
  signature: string,
  hashAlgo: HashAlgo,
  wordCount: number
): Promise<boolean> {
  console.log(`LEGACY FUNCTION: Using recordArticleOnEduChain. Consider using recordArticleDirectlyOnEduChain instead.`);

  const educhainApi = sdk('educhain').api
  const signer = await polkadotSigner()
  if (!signer) throw new Error('No signer found')
  const tx = educhainApi.tx.News.record_article({
    collection_id: BigInt(collectionId),
    item_id: BigInt(itemId),
    content_hash: Binary.fromHex(contentHash),
    signature: MultiSignature.Sr25519(Binary.fromHex(signature)),
    hash_algo: { type: hashAlgo, value: undefined },
    word_count: wordCount,
    title: Binary.fromText(title),
    canonical_url: Binary.fromText(canonicalUrl),
  })

  // Return a Promise that resolves when the transaction is finalized
  return new Promise((resolve) => {
    tx.signSubmitAndWatch(signer).subscribe({
      next(event) {
        if (event.type === 'finalized') {
          console.log(`Article successfully recorded on EduChain with collection ID ${collectionId}, item ID ${itemId}`);
          resolve(true);
        }
      },
      error(e) {
        console.error('Error recording article on EduChain:', e);
        resolve(false);
      }
    });
  })
}



