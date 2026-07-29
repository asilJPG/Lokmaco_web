import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost';
  const rpID = host.split(':')[0];

  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });

  cookies().set('login_challenge', options.challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 300,
    path: '/',
  });

  return Response.json(options);
}
