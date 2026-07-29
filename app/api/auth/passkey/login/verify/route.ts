import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { setSessionCookie } from '@/lib/auth-session';
import { getPasskeyByCredentialId, getUserById, getUserFilials, updateLastLogin, bumpPasskeyCounter } from '@/lib/users';

export async function POST(req: Request) {
  const body = await req.json();
  const expectedChallenge = cookies().get('login_challenge')?.value;
  if (!expectedChallenge) return Response.json({ error: 'Challenge missing' }, { status: 400 });

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
  const rpID = host.split(':')[0];
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const origin = `${proto}://${host}`;

  const passkey = await getPasskeyByCredentialId(body.id);
  if (!passkey) return Response.json({ error: 'Device not registered' }, { status: 404 });

  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, 'base64'),
      counter: passkey.counter,
    },
  });

  if (!verification.verified || !verification.authenticationInfo) {
    return Response.json({ verified: false, error: 'Verification failed' }, { status: 400 });
  }

  await bumpPasskeyCounter(passkey.credentialId, verification.authenticationInfo.newCounter);

  if (!passkey.userId) return Response.json({ error: 'Passkey not linked to user' }, { status: 400 });
  const user = await getUserById(passkey.userId);
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const filialIds = await getUserFilials(user.id);

  await setSessionCookie({
    id: user.id,
    tgId: user.tgId,
    name: user.name,
    role: user.role,
    filialIds,
  });
  cookies().delete('login_challenge');
  await updateLastLogin(user.id, 'passkey').catch(() => {});

  return Response.json({
    verified: true,
    user: { id: user.id, name: user.name, role: user.role, filialIds },
  });
}
