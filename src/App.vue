<script setup lang="ts">
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import PublisherAccordion from './components/PublisherAccordion.vue'
import ArticleSubmitDialog from './components/ArticleSubmitDialog.vue'
import { ref, onMounted } from 'vue'
import { getAllDisplayArticles, recordArticleOnEduChain } from './utils/sdk-interface'
import { useTransaction } from '~/composables/useTransaction'
import { HashAlgo, type ArticleRecord } from './types'
import { Button } from 'primevue'
import Toast from 'primevue/toast';

const articles = ref<ArticleRecord[]>([])
const loading = ref(false)
const showSubmitDialog = ref(false)
const showVerifyDialog = ref(false)
const verifyArticleObj = ref<any>(null)
const verifyLoading = ref(false)
const { result, txHash } = useTransaction()

async function loadPublishers() {
  loading.value = true
  articles.value = await getAllDisplayArticles()
  loading.value = false
}

onMounted(async () => {
  await loadPublishers()
})

function openDialog() {
  showSubmitDialog.value = true
}

async function handleCloseSubmit() {
  showSubmitDialog.value = false
}

function handleVerifyDialog(article: any) {
  verifyArticleObj.value = article
  showVerifyDialog.value = true
}

// Add these to fix missing function errors for emits
async function handleVerifyDirect(article: any) {
  if (!article) return

  verifyLoading.value = true

  try {
    await recordArticleOnEduChain(
      article.title,
      article.canonical_url,
      article.collection_id,
      article.item_id,
      article.content_hash,
      article.signature || '',
      article.hash_algo || HashAlgo.Blake2b256,
      article.word_count || 0,
    )

    // The transaction state watchers will handle showing the appropriate toasts
    await loadPublishers()
  } catch (e) {
    console.error('Error verifying article:', e)
    // Error will be handled by the error watcher
  } finally {
    verifyLoading.value = false
  }
}
</script>

<template>
  <Toast />
  <div class="min-h-screen flex flex-col justify-between">
    <Header />

    <section class="bg-white block sm:block">
      <div class="container mx-auto px-4 text-center">
        <h1 class="text-5xl font-bold text-gray-900 mb-4">
          <span>Verify your articles.</span>
        </h1>
        <p class="text-xl text-gray-600 font-mono flex items-center justify-center gap-2">
          <span>Powered by</span>
          <span class="icon-[token-branded--polkadot] animate-spin" style="animation-duration: 16s;" />
        </p>
      </div>
      <div class="flex justify-center mb-4 mt-6">
        <Button label="Submit New Article" @click="openDialog" />
      </div>
    </section>

    <main class="container mx-auto py-8 space-y-8">
      <!-- Show latest transaction result -->
      <div v-if="result" class="mb-4 text-center">
        <span class="px-4 py-2 rounded bg-gray-100 text-gray-800 border border-gray-300">
          {{ result }}
          <a v-if="txHash"
            :href="`https://polkadot.js.org/apps/?rpc=wss%3A%2F%2Fasset-hub-kusama-rpc.polkadot.io#/explorer/query/${txHash}`"
            target="_blank" class="ml-2 text-blue-500 hover:underline">
            View Transaction
          </a>
        </span>
      </div>

      <!-- All dialogs and tables now handled by child components below -->
      <!-- Dialog for submitting a new article -->
      <ArticleSubmitDialog v-model:visible="showSubmitDialog" @reload="loadPublishers" @close="handleCloseSubmit" />

      <!-- Accordion for publishers and their articles -->
      <PublisherAccordion :articles="articles" :loading="loading" @verify="handleVerifyDialog"
        @verify-direct="handleVerifyDirect" />

    </main>

    <Footer />
  </div>
</template>