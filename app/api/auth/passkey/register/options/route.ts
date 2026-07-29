import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoUint8Array } from '@simplewebauthn/server/helpers';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth-session';
import { getUserPasskeys } from '@/lib/users';

export async function POST(req: Request) {
  const session = await requireSession();

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
  const rpID = host.split(':')[0];

  const existing = await getUserPasskeys(session.id);
  const excludeCredentials = existing.map((k) => ({
    id: k.credentialId,
    transports: ['internal'] as ('internal')[],
  }));

  const options = await generateRegistrationOptions({
    rpName: process.env.RP_NAME || 'Lokmaco',
    rpID,
    userID: isoUint8Array.fromUTF8String(String(session.id)),
    userName: session.name || `User ${session.id}`,
    userDisplayName: session.name || `User ${session.id}`,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  cookies().set('reg_challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300,
    path: '/',
  });

  return Response.json(options);
}
