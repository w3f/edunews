<script setup lang="ts">
import { ref, defineProps, defineEmits, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import { polkadotSigner } from '../utils/sdk-interface' // Still need this for signing
import { HashAlgo } from '~/types'
import { useConnect } from '~/composables/useConnect'
import { useTransaction } from '~/composables/useTransaction'
import { blake2AsU8a } from '@polkadot/util-crypto'
import { toHex } from 'polkadot-api/utils'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits(['reload', 'close'])

const articleTitle = ref('')
const articleUrl = ref('')
const articleContent = ref('')
const loading = ref(false)
const creatingNft = ref(false)
const step = ref<'form' | 'signing' | 'registering' | 'minting-nft' | 'done'>('form')
const registeredArticle = ref<{ collectionId: number, itemId: number, nftCreated?: boolean } | null>(null)
const selectedHashAlgo = ref<HashAlgo>(HashAlgo.Blake2b256)
const hashAlgoOptions = [
    { label: 'Blake2b-256', value: HashAlgo.Blake2b256 },
    // { label: 'SHA-256', value: HashAlgo.SHA256 }
]
const { selectedAccount } = useConnect()
const toast = useToast()
const { 
    isPending, 
    isSuccess, 
    error, 
    result,
    recordArticleDirectlyOnEduChain
} = useTransaction()

// Watch for transaction state changes to show toast notifications
watch(isPending, (newValue) => {
    console.log('isPending watcher triggered in ArticleSubmitDialog:', newValue)
    if (newValue) {
        console.log('Showing pending toast notification')
        toast.add({ 
            severity: 'info', 
            summary: 'Processing', 
            detail: 'Transaction is being processed...', 
            life: 3000
        })
    }
})

// Watch for success with check for previous value
watch(isSuccess, (newValue, oldValue) => {
    console.log('isSuccess watcher triggered in ArticleSubmitDialog:', newValue, 'previous:', oldValue, 'result:', result.value)
    if (newValue && !oldValue) {
        console.log('Showing success toast notification')
        toast.add({ 
            severity: 'success', 
            summary: 'Success', 
            detail: result.value || 'Transaction completed successfully', 
            life: 5000 
        })
    }
})

// Watch for errors
watch(error, (newValue) => {
    console.log('error watcher triggered in ArticleSubmitDialog:', newValue)
    if (newValue) {
        console.log('Showing error toast notification:', newValue.message)
        toast.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: newValue.message || 'Transaction failed', 
            life: 5000 
        })
    }
})

// Calculate content hash and get signature
async function handleSubmit() {
    if (!selectedAccount.value) {
        toast.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'Please connect your wallet first', 
            life: 3000 
        })
        return
    }
    
    // Set UI state
    loading.value = true
    step.value = 'signing'
    
    try {
        toast.add({ 
            severity: 'info', 
            summary: 'Signing', 
            detail: 'Preparing content hash and signature...', 
            life: 2000 
        })
        
        // Get content hash and signature
        const hashBytes = blake2AsU8a(articleContent.value)
        const contentHash = toHex(hashBytes)
        const signer = await polkadotSigner()
        if (!signer) throw new Error('No signer available')
        
        const signature = await signer.signBytes(hashBytes)
        const wordCount = articleContent.value.trim().split(/\s+/).length
        
        console.log('Hash bytes:', contentHash)
        console.log('Signature:', toHex(signature))
        
        // Update UI
        step.value = 'registering'
        
        toast.add({ 
            severity: 'info', 
            summary: 'Verifying', 
            detail: 'Creating NFT and registering article... This is a two-step process.', 
            life: 3000 
        })
        
        // NEW FLOW: Use recordArticleDirectlyOnEduChain which now:
        // 1. First creates NFT on AssetHub (with collection creation if needed)
        // 2. Then registers on EduChain using confirmed collection and item IDs
        const result = await recordArticleDirectlyOnEduChain(
            articleTitle.value,
            articleUrl.value,
            selectedAccount.value.address,
            contentHash,
            toHex(signature),
            selectedHashAlgo.value,
            wordCount
        )
        
        if (result) {
            registeredArticle.value = result as { collectionId: number, itemId: number, nftCreated: boolean }
            console.log('Article registered and NFT created:', registeredArticle.value)
            
            // Update UI state
            loading.value = false
            // With the new flow, we go directly to minting-nft step since NFT is already created
            step.value = 'minting-nft'
            emit('reload')
            
            // Inform the user about the NFT creation
            if (registeredArticle.value.nftCreated) {
                toast.add({ 
                    severity: 'success', 
                    summary: 'NFT Created', 
                    detail: `NFT successfully created with collection ID ${registeredArticle.value.collectionId} and item ID ${registeredArticle.value.itemId}`, 
                    life: 5000 
                })
            }
        } else {
            throw new Error('Failed to register article and create NFT')
        }
        
    } catch (e) {
        console.error('Error registering article on EduChain:', e)
        loading.value = false
        step.value = 'form'
    }
}

// Reset form when closing dialog
function handleClose() {
    step.value = 'form'
    articleTitle.value = ''
    articleUrl.value = ''
    articleContent.value = ''
    registeredArticle.value = null
    selectedHashAlgo.value = HashAlgo.Blake2b256
    loading.value = false
    creatingNft.value = false
    emit('close')
}
</script>

<template>
    <Toast />
    <Dialog v-model:visible="props.visible" header="Submit Article" :modal="true" style="width: 80%;"
        @hide="handleClose">
        <template v-if="step === 'form'">
            <form @submit.prevent="handleSubmit" class="flex flex-col gap-4">
                <InputText v-model="articleTitle" placeholder="Article Title" />
                <InputText v-model="articleUrl" placeholder="Article URL" />
                <Textarea v-model="articleContent" autoResize rows="6" placeholder="Paste article content here..." />
                <div class="mb-2">
                    <label for="hash-algo" class="block text-sm font-medium mb-1">Hash Algorithm</label>
                    <Dropdown id="hash-algo" v-model="selectedHashAlgo" :options="hashAlgoOptions" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <div class="flex gap-2 justify-end">
                    <Button type="button" label="Cancel" severity="secondary" @click="handleClose" />
                    <Button type="submit" label="Submit" :loading="loading" />
                </div>
            </form>
        </template>
        <template v-else-if="step === 'signing'">
            <div class="flex flex-col items-center gap-4 py-8">
                <span class="pi pi-spin pi-spinner text-2xl"></span>
                <span>Signing article content hash... Please wait.</span>
            </div>
        </template>
        <template v-else-if="step === 'registering'">
            <div class="flex flex-col items-center gap-4 py-8">
                <span class="pi pi-spin pi-spinner text-2xl"></span>
                <span>Creating NFT and registering article... Please wait.</span>
                <p class="text-sm text-gray-600 mt-2">This is a two-step process:</p>
                <ol class="text-sm text-gray-600 list-decimal list-inside text-left">
                    <li>First creating NFT on AssetHub (with collection creation if needed)</li>
                    <li>Then registering on EduChain using confirmed collection and item IDs</li>
                </ol>
                <div v-if="isPending" class="text-sm text-blue-600 mt-2">Transaction is being processed...</div>
                <div v-if="error" class="text-sm text-red-600 mt-2">{{ error.message }}</div>
            </div>
        </template>
        <template v-else-if="step === 'minting-nft'">
            <div class="flex flex-col items-center gap-4 py-8">
                <span class="text-green-600">Article registered and NFT created successfully!</span>
                <div class="bg-gray-100 rounded p-4 w-full max-w-xl text-left">
                    <div><strong>Title:</strong> {{ articleTitle }}</div>
                    <div><strong>URL: </strong> {{ articleUrl }}</div>
                    <div><strong>Collection ID: </strong> {{ registeredArticle?.collectionId }}</div>
                    <div><strong>Item ID: </strong> {{ registeredArticle?.itemId }}</div>
                    <div v-if="result"><strong>Result: </strong> {{ result }}</div>
                </div>
                <Button label="Close" severity="secondary" @click="handleClose" />
                <div v-if="error" class="text-sm text-red-600 mt-2">{{ error.message }}</div>
            </div>
        </template>
        <!-- The 'done' step is no longer used with the new flow, but kept for completeness -->
        <template v-else-if="step === 'done'">
            <div class="flex flex-col items-center gap-4 py-8">
                <span class="text-green-600">Article registered on EduChain and NFT created on AssetHub!</span>
                <div class="bg-gray-100 rounded p-4 w-full max-w-xl text-left">
                    <div><strong>Title:</strong> {{ articleTitle }}</div>
                    <div><strong>Collection ID: </strong> {{ registeredArticle?.collectionId }}</div>
                    <div><strong>Item ID: </strong> {{ registeredArticle?.itemId }}</div>
                </div>
                <Button label="Close" severity="secondary" @click="handleClose" />
            </div>
        </template>
    </Dialog>
</template>
