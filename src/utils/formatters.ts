import type { Prefix } from '~/utils/sdk'
import { decodeAddress, encodeAddress } from '@polkadot/util-crypto'

const subscan: Record<Prefix, string> = {
  pas_asset_hub: 'https://assethub-paseo.subscan.io',
  pas_people_hub: 'https://people-paseo.subscan.io',
  educhain: '',
}

export function unifyAddress(address: string) {
  const publicKey = decodeAddress(address)
  return encodeAddress(publicKey, 0)
}

export function stripAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function formatPrice(price: string, decimals: number): string {
  return (Number(price) / 10 ** decimals).toFixed(4).toLocaleString()
}

export function explorerAccount(chain: Prefix, address?: string): string {
  const url = new URL(subscan[chain])
  url.pathname = `/account/${address || ''}`

  return url.toString()
}

export function explorerDetail(chain: Prefix, hash: string): string {
  const url = new URL(subscan[chain])
  url.pathname = `/block/${hash}`

  return url.toString()
}
