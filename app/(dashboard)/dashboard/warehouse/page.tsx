import { CategoryGrid } from '@/components/category-grid';

export const metadata = { title: 'Склад' };

export default function WarehousePage() {
  return (
    <div>
      <h1 className="page-title">Склад</h1>
      <p className="page-subtitle">Остатки, перемещения, инвентаризация, документы iiko.</p>
      <CategoryGrid tiles={[
        { href: '/dashboard/balances', icon: '📦', title: 'Остатки', desc: 'Текущие запасы iiko с поиском и экспортом' },
        { href: '/dashboard/transfer', icon: '🔄', title: 'Перемещение', desc: 'Между складами · сразу в iiko или через подтверждение' },
        { href: '/dashboard/invoice', icon: '🚚', title: 'Приход накладной', desc: 'Текст накладной → AI-распознавание → документ в iiko' },
        { href: '/dashboard/inventory', icon: '📋', title: 'Инвентаризация', desc: 'Ввести фактические остатки на складе' },
        { href: '/dashboard/production', icon: '🍳', title: 'Приготовление', desc: 'Заготовки и полуфабрикаты' },
        { href: '/dashboard/documents', icon: '📑', title: 'Документы iiko', desc: 'Все документы за период, фильтр по типу' },
      ]} />
    </div>
  );
}
