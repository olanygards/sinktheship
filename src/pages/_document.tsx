import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="sv">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8bb8a8" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                      console.log('ServiceWorker registration successful');
                    })
                    .catch(err => {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </Html>
  );
} 