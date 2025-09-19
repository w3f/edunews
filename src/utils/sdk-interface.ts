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

// Create a new collection for a publisher if none exists
export async function createPublisherCollection(publisherAddress: string): Promise<number> {
  const unified = unifyAddress(publisherAddress)
  console.log("Creating NFT collection for:", unified)
  const assetApi = sdk('pas_asset_hub').api
  const signer = await polkadotSigner()
  if (!signer) throw new Error('No signer found')

  try {
    // Get the next collection ID directly from the chain
    let collectionId = await assetApi.query.Nfts.NextCollectionId.getValue();
    if (collectionId === undefined) {
      collectionId = 0;
    }
    console.log(`Next collection ID will be: ${collectionId}`);

    // Create the collection transaction
    const createTx = assetApi.tx.Nfts.create({
      admin: MultiAddress.Id(unified),
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
    });

    // Create the metadata transaction
    const metadataTx = assetApi.tx.Nfts.set_collection_metadata({
      collection: collectionId,
      data: Binary.fromText('news')
    });

    // Batch the two transactions together
    const batchTx = assetApi.tx.Utility.batch({
      calls: [createTx.decodedCall, metadataTx.decodedCall]
    });

    // Return a Promise that resolves when the transaction is finalized
    return new Promise((resolve, reject) => {
      batchTx.signSubmitAndWatch(signer).subscribe({
        next(event) {
          if (event.type === 'finalized') {
            console.log(`Collection ${collectionId} created and metadata set successfully`);
            resolve(collectionId);
          }
        },
        error(e) {
          console.error('Error creating collection:', e);
          reject(e);
        }
      });
    });
  } catch (error) {
    console.error('Error in createPublisherCollection:', error);
    throw error;
  }
}

// Get or create a publisher collection for an address
export async function getOrCreatePublisherCollection(address: string): Promise<number> {
  const unified = unifyAddress(address)
  console.log('Looking for collection for address:', unified)
  const collections = await getAllNewsPublisherCollections()
  console.log('Found collections:', collections)
  const found = collections.find(c => c.publisher === unified)
  console.log('Matching collection:', found)
  if (found) return found.collectionId

  // Create a new collection for this publisher
  return await createPublisherCollection(unified)
}


/**
 * Legacy function: Create NFT for an already-registered article
 * 
 * NOTE: This function is maintained for backward compatibility.
 * The recommended approach is to use recordArticleDirectlyOnEduChain which creates
 * the NFT first, then records on EduChain.
 * 
 * - Creates collection if it doesn't exist
 * - Uses the item ID from EduChain registration
 * - Mints NFT and sets metadata on AssetHub
 * - Returns success status and the item ID
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

    // If collection doesn't exist, create it first
    if (!collectionExists) {
      console.log(`Collection ${collectionId} doesn't exist yet, creating it now`);
      try {
        // Create the collection (this creates it with the expected collectionId)
        await createPublisherCollection(unified);
      } catch (e) {
        console.error('Failed to create collection:', e);
        return { success: false };
      }
    }

    // Now we can use the provided eduChainItemId directly
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
 * Updated flow: First create NFT on AssetHub, then record on EduChain.
 * This ensures we have confirmed collection and item IDs before recording on EduChain.
 * Creates collection if needed, mints NFT, and then records article on EduChain.
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
  console.log(`Step 1: Creating NFT on AssetHub first to ensure confirmed IDs`);

  // Check if publisher already has a collection
  const collections = await getAllNewsPublisherCollections();
  const existingCollection = collections.find(c => c.publisher === unified);

  // Step 1A: Handle collection creation if needed
  let collectionId: number;
  if (existingCollection) {
    collectionId = existingCollection.collectionId;
    console.log(`Using existing collection ID: ${collectionId}`);
  } else {
    console.log(`No existing collection found. Creating new collection...`);
    try {
      collectionId = await createPublisherCollection(unified);
      console.log(`Created new collection with ID: ${collectionId}`);
    } catch (error) {
      console.error(`Failed to create new collection: ${error}`);
      throw new Error(`Failed to create NFT collection: ${error}`);
    }
  }

  // Step 1B: Determine item ID and mint NFT
  const itemId = await getNextItemId(collectionId);
  console.log(`Using item ID: ${itemId} for new NFT`);

  const assetApi = sdk('pas_asset_hub').api;
  const eduChainApi = sdk('educhain').api;
  const signer = await polkadotSigner();
  if (!signer) throw new Error('No signer found');

  try {
    console.log(`Step 2: Minting NFT with collection ID ${collectionId}, item ID ${itemId}`);

    // Create and mint NFT
    const mintTx = createMintNftTx(assetApi, collectionId, itemId, unified);
    const itemMetadataTx = createSetMetadataTx(assetApi, collectionId, itemId, contentHash);
    const batchCalls = [mintTx.decodedCall, itemMetadataTx.decodedCall];
    const batchTx = assetApi.tx.Utility.batch({ calls: batchCalls });

    // Wait for NFT creation to finalize
    await new Promise<void>((resolve, reject) => {
      batchTx.signSubmitAndWatch(signer).subscribe({
        next(event) {
          if (event.type === 'finalized') {
            console.log(`NFT created successfully with collection ID ${collectionId}, item ID ${itemId}`);
            resolve();
          }
        },
        error(e) {
          console.error('Error creating NFT:', e);
          reject(e);
        }
      });
    });

    // Step 3: Record article on EduChain with confirmed collection and item IDs
    console.log(`Step 3: Recording article on EduChain with confirmed collection ID ${collectionId}, item ID ${itemId}`);

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

    // Return a Promise that resolves when the transaction is finalized
    return new Promise((resolve, reject) => {
      tx.signSubmitAndWatch(signer).subscribe({
        next(event) {
          if (event.type === 'finalized') {
            console.log(`Article successfully recorded on EduChain with collection ID ${collectionId}, item ID ${itemId}`);
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



