# mangadex-malsync

This is a proxy server that integrates [MALSync](https://github.com/MALSync/MALSync) with
[MangaDex](https://mangadex.org).

My motivation for this is the fact that there isn't an iOS app for syncing MangaDex progress to MyAnimeList or Anilist.
This project solves this problem.

## Usage

Run `npm install` and then `npm start`. Then, visit `http://localhost:8080` or whatever the server is running on. This
will be the MangaDex page.

For MALSync to work, you'll need to import the configuration manually. To do that, you'll first need to install the
Tampermonkey extension either in Chrome or Firefox, and then
[install the MALSync userscript](https://github.com/MALSync/MALSync/releases/latest/download/malsync.user.js). Then,
visit [MALSync's page](https://malsync.moe) and connect your accounts. Finally, open the MALSync script in Tampermonkey
and click on the storage tab. Copy the whole JSON into a file. Then, visit
`http://localhost:8080/pwa/#/settings/tracking`, scroll down, and import the JSON file you created earlier.

Don't use the export function since that only exports the local anime/manga entries and not the authentication tokens.

### iOS support

Host this server somewhere like on render.com (which is what I did) and visit the URL on an iOS device. Then, click on
the share button and select "Add to Home Screen." Remember to transfer the config file from your computer to your device
to import. To access the MALSync page on iOS, select the profile icon in the top right corner and select the MALSync
link.

## Updating MALSync

To update MALSync, simply run `npm run get-malsync-userscript`. Then restart the server.
