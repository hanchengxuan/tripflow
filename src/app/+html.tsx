import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" name="viewport" />
        {/* The SVG carries both themes in one file; the PNG is the fallback for
            browsers that will not take an SVG favicon. */}
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
        <link href="/favicon-32.png" rel="icon" sizes="32x32" />
        <link href="/apple-touch-icon-180.png" rel="apple-touch-icon" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
