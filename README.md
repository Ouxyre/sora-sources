# ani.pm — Hard Sub only

Sora/Shirox source for ani.pm. Lists only episodes the site explicitly marks as having hard subtitles. Requests that version and refuses soft-sub or dub fallbacks. Subtitles are burned into the site's video; this module does not convert videos or attach subtitle files.

Titles without confirmed hard-sub episodes are hidden. Episode numbers can have gaps when only some episodes have hard subtitles.

## Host and install

1. Upload `anipm-hardsub.js` and `anipm-hardsub.json` to a public GitHub repository (or another HTTPS file host).
2. Open the included `configure.html` on your computer. Paste the **raw folder URL** containing those files, for example `https://raw.githubusercontent.com/YOURNAME/YOURREPO/main/`.
3. Download the configured JSON and replace `anipm-hardsub.json` in your repository with it.
4. Import its raw URL in Sora/Shirox's module settings, for example `https://raw.githubusercontent.com/YOURNAME/YOURREPO/main/anipm-hardsub.json`.

If you upload inside a folder, include that folder in both URLs. GitHub `/blob/` page URLs will not work. The supplied JSON contains a `YOUR-HOST` placeholder until configured. The setup helper works offline.

Alternatively, edit `scriptUrl` in the JSON directly to your publicly accessible raw JavaScript URL. No server or API key is required.

## Verification and limits

Checked on October 2, 2026: live search, details, episode listing, player session, HLS master playlist, and media playlist. Frieren returned 25 confirmed hard-sub episodes. Checks also covered strict availability flags, refusing soft-sub/dub sessions and external subtitle tracks, and the legacy string-fetch interface.

Playback inside Sora/Shirox has **not** been tested. Live network checks used IPv4 with a browser user-agent; Cloudflare or network restrictions may still affect the app. An empty list or no stream can mean no hard-sub version is available, access is blocked, or the site's API has changed.

Stream URLs expire. Reopen the episode to obtain a fresh session. The player must preserve the returned request headers for playlists, segments and encryption keys. Available resolution depends on the episode.

The source uses ani.pm's public partner API and its Settlar player. Search checks the first 30 matching titles for hard-sub availability. It does not use a third-party extraction service.

Reference: https://ani.pm/developers
