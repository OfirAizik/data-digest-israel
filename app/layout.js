export const metadata = {
  title: "Data Digest Israel",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { background: #0a0f1a; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
