<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getIdentityFromAddress, checkNftExists } from '../utils/sdk-interface'
import ArticleBadge from './ArticleBadge.vue'
import type { ArticleRecord } from '../types'

import Card from 'primevue/card'
import Divider from 'primevue/divider'

interface IdentityStatus {
    display: string
    verified: boolean
}

const props = defineProps<{ articles: ArticleRecord[] }>()

const publisherIdentities = ref<Record<string, IdentityStatus>>({})
const nftStatus = ref<Record<string, boolean>>({})

onMounted(async () => {
    // Get unique publisher addresses
    const publishers = [...new Set(props.articles.map(article => article.publisher).filter(Boolean))]

    // Get publisher identities
    for (const publisher of publishers) {
        const identity = await getIdentityFromAddress(publisher)
        publisherIdentities.value[publisher] =
            identity?.display ?
                { display: identity?.display, verified: true } :
                { display: publisher.substring(0, 6) + '...' + publisher.substring(publisher.length - 4), verified: false }
    }

    // Check NFT existence for each article
    for (const article of props.articles) {
        if (article.content_hash) {
            nftStatus.value[article.content_hash] = await checkNftExists(
                article.collection_id,
                article.item_id,
                article.content_hash
            )
        }
    }
})


</script>

<template>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card v-for="article in articles" :key="article.content_hash || article.item_id" class="h-full">
            <template #header>
                <div class="p-4 pb-0">
                    <!-- Title -->
                    <h3 v-if="article.title" class="font-semibold text-lg leading-tight mb-3 line-clamp-2"
                        :title="article.title">
                        {{ article.title }}
                    </h3>
                    <div v-else class="mb-3">
                        <ArticleBadge type="unverified">No Title</ArticleBadge>
                    </div>

                    <!-- Publisher Info -->
                    <div v-if="Object.keys(publisherIdentities).length > 0" class="flex items-center gap-2 mb-3">
                        <span class="text-sm text-gray-600">By:</span>
                        <span class="text-sm font-medium">
                            {{ publisherIdentities[article.publisher].display || 'Unknown' }}
                        </span>
                        <ArticleBadge v-if="publisherIdentities[article.publisher].verified" type="verified"
                            class="text-xs">
                            Verified
                        </ArticleBadge>
                        <ArticleBadge v-else type="unverified" class="text-xs">
                            Unverified
                        </ArticleBadge>
                    </div>

                    <!-- Status Badges -->
                    <div class="flex gap-2">
                        <ArticleBadge v-if="article.content_hash && nftStatus[article.content_hash]" type="verified">
                            NFT Created
                        </ArticleBadge>
                        <ArticleBadge v-else type="unverified">
                            No NFT
                        </ArticleBadge>
                        <ArticleBadge v-if="article.content_hash" type="verified">Verified</ArticleBadge>
                        <ArticleBadge v-else type="unverified">Unverified</ArticleBadge>
                    </div>
                </div>
            </template>

            <template #content>
                <div class="space-y-3">
                    <!-- URL -->
                    <div v-if="article.canonical_url">
                        <a :href="article.canonical_url" target="_blank" rel="noopener noreferrer"
                            class="text-blue-600 hover:text-blue-800 underline text-sm break-all"
                            :title="article.canonical_url">
                            {{ article.canonical_url.length > 40 ? article.canonical_url.substring(0, 40) + '...' :
                                article.canonical_url }}
                        </a>
                    </div>

                    <Divider />

                    <!-- Key Info Grid -->
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div>
                            <span class="text-gray-600 block">Collection</span>
                            <span class="font-medium">{{ article.collection_id || 'N/A' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 block">Item ID</span>
                            <span class="font-medium">{{ article.item_id || 'N/A' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 block">Words</span>
                            <span class="font-medium">{{ article.word_count?.toLocaleString() || 'N/A' }}</span>
                        </div>
                        <div>
                            <span class="text-gray-600 block">Algorithm</span>
                            <span class="font-medium">{{ article.hash_algo || 'N/A' }}</span>
                        </div>
                    </div>

                    <!-- Content Hash -->
                    <div v-if="article.content_hash">
                        <span class="text-gray-600 text-sm block mb-1">Content Hash</span>
                        <code class="text-xs bg-gray-100 px-2 py-1 rounded block font-mono break-all">
                            {{ article.content_hash }}
                        </code>
                    </div>
                </div>
            </template>
        </Card>
    </div>
</template>
