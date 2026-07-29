import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth-session';
import { savePasskey } from '@/lib/users';

export async function POST(req: Request) {
  const session = await requireSession();
  const body = await req.json();
  const expectedChallenge = cookies().get('reg_challenge')?.value;
  if (!expectedChallenge) return Response.json({ error: 'Challenge missing' }, { status: 400 });

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
  const rpID = host.split(':')[0];
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const origin = `${proto}://${host}`;

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return Response.json({ verified: false }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  await savePasskey(
    session.id,
    credential.id,
    Buffer.from(credential.publicKey).toString('base64'),
    credential.counter
  );

  cookies().delete('reg_challenge');
  return Response.json({ verified: true });
}
