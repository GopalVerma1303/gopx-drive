"use client";

import Head from "expo-router/head";

/** Default meta/OG for the main app. Used by (app), (auth), and index so that share route is not wrapped and can set its own meta. */
export function DefaultAppHead() {
  return (
    <Head>
      <title>Gopx Drive — Your files &amp; folders, organized</title>
      <meta name="title" content="Gopx Drive — Your files &amp; folders, organized" />
      <meta
        name="description"
        content="Your files &amp; folders, organized. Notes, calendars, and sync across devices."
      />
      <meta name="keywords" content="notes, markdown, file storage, drive, sync, calendar, productivity" />
      <meta name="author" content="Gopx Drive" />
      <link rel="canonical" href="/" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="/" />
      <meta property="og:title" content="Gopx Drive — Your files &amp; folders, organized" />
      <meta
        property="og:description"
        content="Your files &amp; folders, organized. Notes, calendars, and sync across devices."
      />
      <meta property="og:image" content="/assets/images/favicon.png" />
      <meta property="og:site_name" content="Gopx Drive" />
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content="/" />
      <meta name="twitter:title" content="Gopx Drive — Your files &amp; folders, organized" />
      <meta
        name="twitter:description"
        content="Your files &amp; folders, organized. Notes, calendars, and sync across devices."
      />
      <meta name="twitter:image" content="/assets/images/favicon.png" />
    </Head>
  );
}
