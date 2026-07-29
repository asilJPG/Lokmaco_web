import { redirect } from 'next/navigation';

/** Раздел переехал во вкладку единой «Аналитики» — сохраняем старые ссылки. */
export default function LegacyRedirect() {
  redirect('/dashboard/analytics?tab=abc');
}
