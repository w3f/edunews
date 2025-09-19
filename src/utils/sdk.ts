import type { PolkadotClient, TypedApi } from 'polkadot-api'
import { createClient } from 'polkadot-api'
import { withPolkadotSdkCompat } from 'polkadot-api/polkadot-sdk-compat'
import { getWsProvider } from 'polkadot-api/ws-provider/web'
import { ref } from 'vue'
import { educhain, pas_asset_hub, pas_people_hub } from '~/descriptors'

const config = {
  pas_asset_hub: {
    descriptor: pas_asset_hub,
    providers: ['ws://127.0.0.1:9933'],
  },
  pas_people_hub: {
    descriptor: pas_people_hub,
    providers: ['wss://people-paseo.rpc.amforc.com'],
  },
  educhain: {
    descriptor: educhain,
    providers: ['ws://127.0.0.1:9935']
  }
} as const

const _config = {
  pas_asset_hub: {
    descriptor: pas_asset_hub,
    providers: ['wss://paseo-asset-hub-rpc.dwellir.com'],
  },
  pas_people_hub: {
    descriptor: pas_people_hub,
    providers: ['wss://paseo-people-hub-rpc.dwellir.com'],
  },
  educhain: {
    descriptor: educhain,
    providers: ['wss://educhain-rpc.dwellir.com']
  }
} as const

export type Prefix = keyof typeof config
export const chainKeys = Object.keys(config) as Prefix[]

const clients = ref<Partial<Record<Prefix, PolkadotClient>>>({})

export default function sdk<T extends Prefix>(chain: T) {
  if (!clients.value[chain]) {
    clients.value[chain] = createClient(
      withPolkadotSdkCompat(
        getWsProvider(config[chain].providers[0]),
      ),
    )
  }

  return {
    api: clients.value[chain]!.getTypedApi(config[chain].descriptor) as TypedApi<typeof config[T]['descriptor']>,
    client: clients.value[chain]!,
  }
}
