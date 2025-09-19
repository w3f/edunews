<script setup lang="ts">
import { defineProps, defineEmits, computed, ref, onMounted } from 'vue'
import { getIdentityFromAddress, checkNftExists } from '../utils/sdk-interface'
import ArticleBadge from './ArticleBadge.vue'
import type { ArticleRecord } from '../types'

import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const props = defineProps<{ articles: ArticleRecord[] }>()
const emit = defineEmits(['register-nft'])

const publisherIdentities = ref<Record<string, string>>({})
const nftStatus = ref<Record<string, boolean>>({}) // Track NFT existence by hash:boolean

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
    // Get publisher identities
    const pubs = Object.keys(groupedByPublisher.value)
    for (const pub of pubs) {
        const identity = await getIdentityFromAddress(pub)
        publisherIdentities.value[pub] = identity && identity.display ? identity.display : pub
    }

    // Check NFT existence for each article
    for (const article of props.articles) {
        const nftKey = article.content_hash
        nftStatus.value[nftKey] = await checkNftExists(article.collection_id, article.item_id, nftKey)
        console.log('NFT status for', nftKey, 'is', nftStatus.value[nftKey])
    }
})


</script>

<template>
    <div>
        <div v-for="(group, publisher) in groupedByPublisher" :key="publisher" class="mb-8">
            <h2 class="text-xl font-bold mb-2">
                {{ publisherIdentities[publisher] || publisher }}
                <ArticleBadge v-if="publisherIdentities[publisher] && publisherIdentities[publisher] !== publisher"
                    type="verified" class="ml-2">Verified Identity</ArticleBadge>
                <ArticleBadge v-else type="unverified" class="ml-2">Unverified Identity</ArticleBadge>
            </h2>
            <DataTable :value="group">
                <Column header="NFT Status">
                    <template #body="slotProps">
                        <div class="flex flex-col gap-1">
                            <div v-if="nftStatus[`${slotProps.data.content_hash}`]">
                                <ArticleBadge type="verified" class="mt-1">
                                    Registered
                                </ArticleBadge>
                            </div>
                            <div v-else class="flex flex-col items-start gap-2">
                                <ArticleBadge type="unverified" class="mt-1">
                                    Unregistered
                                </ArticleBadge>
                            </div>
                        </div>
                    </template>
                </Column>
                <Column header="Status">
                    <template #body="slotProps">
                        <div class="flex flex-col gap-1">
                            <ArticleBadge v-if="slotProps.data.content_hash" type="verified">Verified</ArticleBadge>
                            <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                        </div>
                    </template>
                </Column>
                <Column field="item_id" header="Item ID">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.item_id }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="collection_id" header="Collection ID">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.collection_id }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="title" header="Title">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.title }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="canonical_url" header="URL">
                    <template #body="slotProps">
                        <a v-if="slotProps.data.content_hash && slotProps.data.canonical_url"
                            :href="slotProps.data.canonical_url" target="_blank" rel="noopener noreferrer"
                            class="text-blue-600 underline">
                            {{ slotProps.data.canonical_url }}
                        </a>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="content_hash" header="Content Hash">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">
                            {{
                                slotProps.data.content_hash.length > 16
                                    ? slotProps.data.content_hash.slice(0, 4) + '...' + slotProps.data.content_hash.slice(-4)
                                    : slotProps.data.content_hash
                            }}
                        </span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="hash_algo" header="Hash Algo">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.hash_algo }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="word_count" header="Word Count">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.word_count }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="last_updated_at" header="Last Updated (block)">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.last_updated_at }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
                <Column field="updates" header="Updates">
                    <template #body="slotProps">
                        <span v-if="slotProps.data.content_hash">{{ slotProps.data.updates }}</span>
                        <ArticleBadge v-else type="unverified">No Metadata</ArticleBadge>
                    </template>
                </Column>
            </DataTable>
        </div>
    </div>
</template>
