import { ScrollViewStyleReset } from "expo-router/html";

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* Primary meta tags */}
        <title>Gopx Drive — Your files &amp; folders, organized</title>
        <meta name="title" content="Gopx Drive — Your files &amp; folders, organized" />
        <meta
          name="description"
          content="Your files &amp; folders, organized. Notes, calendars, and sync across devices."
        />
        <meta name="keywords" content="notes, markdown, file storage, drive, sync, calendar, productivity" />
        <meta name="author" content="Gopx Drive" />
        <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <link rel="canonical" href="/" />

        {/* Open Graph / Facebook — use full URLs for og:url and og:image when deployed (e.g. https://yourapp.com) */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="/" />
        <meta property="og:title" content="Gopx Drive — Your files &amp; folders, organized" />
        <meta
          property="og:description"
          content="Your files &amp; folders, organized. Notes, calendars, and sync across devices."
        />
        <meta property="og:image" content="/assets/images/icon.png" />
        <meta property="og:site_name" content="Gopx Drive" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content="/" />
        <meta name="twitter:title" content="Gopx Drive — Your files &amp; folders, organized" />
        <meta
          name="twitter:description"
          content="Your files &amp; folders, organized. Notes, calendars, and sync across devices."
        />
        <meta name="twitter:image" content="/assets/images/icon.png" />

        {/* 
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native. 
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Using raw CSS styles as an escape-hatch to ensure the background color never flickers in dark-mode. */}
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body>{children}</body>
    </html>
  );
}

const responsiveBackground = `
body {
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}`;
