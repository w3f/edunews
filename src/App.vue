<script setup lang="ts">
import Footer from './components/Footer.vue'
import Header from './components/Header.vue'
import ArticleTable from './components/ArticleTable.vue'
import ArticleSubmitDialog from './components/ArticleSubmitDialog.vue'
import { ref, onMounted } from 'vue'
import { getAllDisplayArticles } from './utils/sdk-interface'
import type { ArticleRecord } from './types'
import { Button } from 'primevue'

const articles = ref<ArticleRecord[]>([])
const loading = ref(false)
const showSubmitDialog = ref(false)

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
</script>

<template>
  <Toast />
  <div class="min-h-screen flex flex-col justify-between">
    <Header />

    <section class="mt-20 bg-white block">
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
      <!-- All dialogs and tables now handled by child components below -->
      <!-- Dialog for submitting a new article -->
      <ArticleSubmitDialog v-model:visible="showSubmitDialog" @reload="loadPublishers" @close="handleCloseSubmit" />

      <!-- Articles Grid -->
      <div v-if="loading" class="text-center py-8">
        <span class="pi pi-spin pi-spinner text-2xl"></span>
        <span class="ml-2">Loading articles...</span>
      </div>
      <ArticleTable v-else :articles="articles" />

    </main>

    <Footer />
  </div>
</template>