import './globals.css';

export const metadata = {
  title: { default: 'Lokmaco', template: '%s · Lokmaco' },
  description: 'Управление сетью',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
