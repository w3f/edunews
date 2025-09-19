import { ref } from 'vue'
import { polkadotSigner, getNextItemId, createMintNftTx, createSetMetadataTx } from '~/utils/sdk-interface'
import sdk from '~/utils/sdk'
import { MultiSignature } from '~/descriptors/dist'
import { Binary } from 'polkadot-api'
import { HashAlgo } from '~/types'

export function useTransaction() {
  // Shared reactive state
  const isPending = ref(false)
  const isSuccess = ref(false)
  const error = ref<Error | null>(null)
  const result = ref('')
  const txHash = ref('')

  // Reset state between transactions
  function resetState() {
    console.log('Transaction: Resetting state, setting isPending=true')
    isPending.value = true
    error.value = null
    isSuccess.value = false
    result.value = ''
    txHash.value = ''
  }

  /**
   * Create NFT for an already-registered article
   * - Uses the collection ID from EduChain but gets the next available item ID
   * - Only mints NFT and sets metadata on AssetHub
   * - Returns the actual item ID used for the NFT
   */
  async function createNftForRegisteredArticle(
    publisherAddress: string,
    collectionId: number,
    eduChainItemId: number,
    contentHash: string
  ) {
    resetState()
    isPending.value = true
    console.log(`Creating NFT for registered article in collection ${collectionId}, EduChain item ID ${eduChainItemId}`)

    try {
      const assetApi = sdk('pas_asset_hub').api
      const signer = await polkadotSigner()
      if (!signer) throw new Error('No signer found')

      // Get the next available item ID for this collection
      const nextItemId = await getNextItemId(collectionId)
      console.log(`Creating NFT with collection ID ${collectionId}, item ID ${nextItemId} (EduChain had ${eduChainItemId})`)

      // Batch mint and set NFT metadata
      const mintTx = createMintNftTx(assetApi, collectionId, nextItemId, publisherAddress)
      const itemMetadataTx = createSetMetadataTx(assetApi, collectionId, nextItemId, contentHash)
      const batchCalls = [mintTx.decodedCall, itemMetadataTx.decodedCall]
      const batchTx = assetApi.tx.Utility.batch({ calls: batchCalls })

      return new Promise((resolve) => {
        isPending.value = true
        batchTx.signSubmitAndWatch(signer).subscribe({
          next(event) {
            console.log('Transaction event:', event.type)

            if (event.type === 'txBestBlocksState' && event.found) {
              console.log('Transaction found in block, hash:', event.block.hash.toString())
              txHash.value = event.block.hash.toString()
            }

            if (event.type === 'finalized') {
              // When finalized
              result.value = `NFT created with ID ${nextItemId}`
              console.log('Transaction result set to:', result.value)
              isPending.value = false
              isSuccess.value = true
              console.log('isSuccess is now:', isSuccess.value)

              // Resolve the promise with the result
              resolve({ success: true, itemId: nextItemId })
            }
          },
          error(e) {
            console.error('Transaction error:', e)
            error.value = e instanceof Error ? e : new Error(String(e))
            isPending.value = false
            isSuccess.value = false
            resolve({ success: false })
          },
          complete() {
            console.log('Transaction subscription completed')
          }
        })
      })
    } catch (e) {
      console.error('Transaction setup error:', e)
      error.value = e instanceof Error ? e : new Error(String(e))
      isPending.value = false
      isSuccess.value = false
      return { success: false }
    }
  }

  /**
   * Updated flow: First create NFT on AssetHub, then record on EduChain.
   * This ensures we have confirmed collection and item IDs before recording on EduChain.
   * Creates collection if needed, mints NFT, and then records article on EduChain.
   */
  async function recordArticleDirectlyOnEduChain(
    title: string,
    canonicalUrl: string,
    publisherAddress: string,
    contentHash: string,
    signature: string,
    hashAlgo: HashAlgo,
    wordCount: number
  ) {
    resetState()
    isPending.value = true
    console.log(`Starting article verification process for publisher ${publisherAddress}`)
    try {
      console.log(`Step 1: Creating NFT on AssetHub first to ensure confirmed IDs`)
      
      // Import the function from sdk-interface
      const { recordArticleDirectlyOnEduChain: sdkRecordArticle } = await import('~/utils/sdk-interface')
      
      // Call the updated function that creates NFT first, then records on EduChain
      const { collectionId, itemId, nftCreated } = await sdkRecordArticle(
        title,
        canonicalUrl,
        publisherAddress,
        contentHash,
        signature,
        hashAlgo,
        wordCount
      )
      
      console.log(`NFT created: ${nftCreated}, Collection ID: ${collectionId}, Item ID: ${itemId}`)
      
      // Set result based on the combined operation
      result.value = `Article verified and NFT created with collection ID ${collectionId} and item ID ${itemId}`
      console.log('Transaction result set to:', result.value)
      isPending.value = false
      isSuccess.value = true
      
      // Return the result with collection and item IDs
      return { collectionId, itemId, nftCreated }

      // No need for a Promise here since sdkRecordArticle already returns a Promise
      // and handles all the transaction submission internally
    } catch (e) {
      console.error('Article verification process error:', e)
      error.value = e instanceof Error ? e : new Error(String(e))
      isPending.value = false
      isSuccess.value = false
      return null;
    }
  }

  /**
   * Record and verify an article on EduChain (provenance).
   * - Registers the article on EduChain with specific IDs.
   * - Used for the legacy flow where NFT is minted first.
   */
  async function recordArticleOnEduChain(
    title: string,
    canonicalUrl: string,
    collectionId: number,
    itemId: number,
    contentHash: string,
    signature: string,
    hashAlgo: HashAlgo,
    wordCount: number
  ) {
    resetState()

    try {
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

      return new Promise((resolve) => {
        tx.signSubmitAndWatch(signer).subscribe({
          next(event) {
            console.log('Record article transaction event:', event.type)

            if (event.type === 'txBestBlocksState' && event.found) {
              console.log('Transaction found in block, hash:', event.block.hash.toString())
              txHash.value = event.block.hash.toString()
            }

            if (event.type === 'finalized') {
              // When finalized
              result.value = `Article registered on EduChain with collection ID ${collectionId} and item ID ${itemId}`
              console.log('Record article transaction result set to:', result.value)
              isPending.value = false
              isSuccess.value = true
              console.log('isSuccess is now:', isSuccess.value)

              // Resolve the promise with the result
              resolve(true)
            }
          },
          error(e) {
            console.error('Record article transaction error:', e)
            error.value = e instanceof Error ? e : new Error(String(e))
            isPending.value = false
            isSuccess.value = false
            resolve(false)
          },
          complete() {
            console.log('Record article transaction subscription completed')
          }
        })
      })
    } catch (e) {
      console.error('Record article transaction setup error:', e)
      error.value = e instanceof Error ? e : new Error(String(e))
      isPending.value = false
      isSuccess.value = false
      return false
    }
  }

  return {
    // State
    isPending,
    isSuccess,
    error,
    result,
    txHash,

    // Transaction methods
    createNftForRegisteredArticle,
    recordArticleDirectlyOnEduChain,
    recordArticleOnEduChain
  }
}
