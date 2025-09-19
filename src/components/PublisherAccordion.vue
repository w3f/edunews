<script setup lang="ts">
import { defineProps, defineEmits, computed, ref, onMounted } from 'vue'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import ArticleTable from './ArticleTable.vue'
import { getIdentityFromAddress } from '../utils/sdk-interface'
import type { ArticleRecord } from '../types'

const props = defineProps<{ articles: ArticleRecord[], loading: boolean }>()
const emit = defineEmits(['verify', 'verify-direct', 'check-signature', 'register-nft'])

const publisherIdentities = ref<Record<string, string>>({})
const groupedByPublisher = computed(() => {
  const map: Record<string, ArticleRecord[]> = {}
  for (const article of props.articles) {
    const pub = article.publisher || 'Unknown'
    if (!map[pub]) map[pub] = []
    map[pub].push(article)
  }
  return map
})

onMounted(async () => {
  const pubs = Object.keys(groupedByPublisher.value)
  for (const pub of pubs) {
    const identity = await getIdentityFromAddress(pub)
    publisherIdentities.value[pub] = identity && identity.display ? identity.display : pub
  }
})
</script>

<template>
  <div v-if="!props.loading">
    <Accordion :multiple="true">
      <AccordionTab v-for="(group, publisher) in groupedByPublisher" :key="publisher" :header="publisherIdentities[publisher] || publisher">
        <ArticleTable 
          :articles="group" 
          @verify="$emit('verify', $event)" 
          @verify-direct="$emit('verify-direct', $event)"
          @check-signature="$emit('check-signature', $event)"
          @register-nft="$emit('register-nft', $event)"
        />
      </AccordionTab>
    </Accordion>
  </div>
  <div v-else class="text-center py-8">
    <span class="pi pi-spin pi-spinner text-2xl"></span>
    <span class="ml-2">Loading articles...</span>
  </div>
</template>
