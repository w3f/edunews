import { createClient } from 'polkadot-api';
// import signer from wallet extension (handled via useConnect or window.injectedWeb3)
// @ts-ignore
import { people, pas_asset_hub } from '../descriptors/dist/index.mjs';
import { getSmProvider } from 'polkadot-api/sm-provider';

// You must have generated descriptors for 'people' and 'assetHub' chains using papi CLI
// See https://papi.how/getting-started for details


export async function getPeopleClient() {
  const chainDesc = await people;
  const client = createClient(getSmProvider(chainDesc));
  return client.getTypedApi(chainDesc);
}
export async function getAssetHubClient() {
  const chainDesc = await pas_asset_hub;
  const client = createClient(getSmProvider(chainDesc));
  return client.getTypedApi(chainDesc);
}