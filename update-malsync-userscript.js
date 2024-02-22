import semver from "semver";

import fs from "node:fs/promises";

(async () => {
    let oldVersion = (await fs.readFile("malsync-version")).toString();
    let newVersion = (await (await fetch("https://github.com/MALSync/MALSync/releases/latest/download/malsync.user.js")).text())
        .match(/\/\/\s*==UserScript==[\s\S]+?@version\s+(\S+)\s+[\s\S]+?\/\/\s*==\/UserScript==/)[1];
    if (semver.gt(newVersion.replace(/\D/g, "."), oldVersion.replace(/\D/g, "."))) {
        console.log("New version detected. Updating...");
        await fs.writeFile("malsync-version", newVersion);
        await import("./get-malsync-userscript.js");
    } else {
        console.log("No new version detected.");
    }
})();
