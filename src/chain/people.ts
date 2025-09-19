import { getPeopleClient } from './papi';

export async function isPublisherVerified(address: string): Promise<boolean> {
  const client = await getPeopleClient();
  const identity = await client.query('pallet_identity', 'identityOf', [address]);
  if (!identity || !identity.info) return false;
  const judgement = identity.judgements?.find((j: any) => j[1] === 'KnownGood' || j[1] === 'Reasonable');
  return Boolean(judgement);
}
