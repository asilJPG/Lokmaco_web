import "./globals.css";

export const metadata = {
  title: "The Lokmaco — iiko Warehouse",
  description: "Приход, перемещение, поиск товаров",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
