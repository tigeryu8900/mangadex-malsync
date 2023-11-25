import express from "express";
import { JSDOM } from "jsdom";
import * as fs from "fs";

const app = express();
app.use (function(req, res, next) {
    let data= "";
    req.setEncoding("utf8");
    req.on("data", function(chunk) {
        data += chunk;
    });

    req.on("end", function() {
        req.body = data ? data : null;
        next();
    });
});

const userscriptPolyfill = fs.readFileSync("./userscript-polyfill.js").toString();

function copyHeaders(from, to) {
    from.headers.forEach((value, key) => {
        try {
            if (![
                "content-encoding"
            ].includes(key.toLowerCase())) {
                to.set(key, value);
            }
        } catch (e) {
            console.error(e);
        }
    });
}

async function injectMalsync(document, srcURL, dstURL) {
    for (let element of document.querySelectorAll(':not(a)[href]')) {
        let href = new URL(element.href, srcURL);
        if (href.hostname !== srcURL.hostname) {
            element.href = `/fetch/${href}`;
        }
    }
    for (let element of document.querySelectorAll('[src]')) {
        let src = new URL(element.src, srcURL);
        if (src.hostname !== srcURL.hostname) {
            element.src = `/fetch/${src}`;
        }
    }
    let malsync = (await (await fetch("https://github.com/MALSync/MALSync/releases/latest/download/malsync.user.js")).text())
        .replace(/\/\/\s*==UserScript==[\s\S]+?\/\/\s*==\/UserScript==/, str => String.raw`
            await callback(${JSON.stringify(str)});
        `)
        .replace(/!firstData\.hasOwnProperty\("\w+"\)/g, "false");
    if (srcURL.pathname.startsWith("/pwa")) {
        malsync = malsync.replace(/\b(?:window\.)?location\.hostname\s*===?\s*(['"`])malsync\.moe\1|(['"`])malsync\.moe\2\s*===?\s*(?:window\.)?location\.hostname\b/g,
            'location.pathname === "/pwa/"')
            .replace(/malsync\.moe\/pwa/g, `${srcURL.host.replaceAll("$", "$$$$")}/pwa`);
    } else {
        malsync = malsync.replace(/(?<!\.)\b(?:www\.)?mangadex\.org\b/g, srcURL.host.replaceAll("$", "$$$$"));
    }
    let malsyncScript = document.createElement("script");
    malsyncScript.textContent = String.raw`
        const __userscript_location__ = window.__userscript_location__ = new URL(${JSON.stringify(dstURL)});
        ${userscriptPolyfill}
        (async () => {
            let callback = await __polyfill_loader__;
            ${malsync}
        })();
    `;
    document.head.appendChild(malsyncScript);
}

app.all("*", async (req, res) => {
    try {
        let url;
        if (req.path.startsWith("/pwa")) {
            url = new URL(req.originalUrl, "https://malsync.moe");
        } else if (req.path.startsWith("/fetch")) {
            url = new URL(req.originalUrl.substring("/fetch/".length));
        } else {
            url = new URL(req.originalUrl, "https://mangadex.org");
        }
        let response = await fetch(url, {
            method: req.method,
            headers: {
                ...req.headers,
                referer: url.origin,
                referrer: url.origin,
                origin: url.origin,
            },
            credentials: req.credentials,
            body: req.body,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            referrerPolicy: req.referrerPolicy,
            integrity: req.integrity
        });
        copyHeaders(response, res);
        if (req.path.startsWith("/fetch")) {
            res.set("Access-Control-Allow-Origin", "*");
            res.set("Access-Control-Allow-Methods", "*");
            res.set("Access-Control-Allow-Headers", "*");
            res.set("Access-Control-Allow-Private-Network", "true");
        }
        if (response.headers.get("content-type")?.includes("text/html")) {
            let dom = new JSDOM(await response.text());
            await injectMalsync(dom.window.document, new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`), url);
            res.send(dom.serialize());
        } else if (url.href === "https://malsync.moe/pwa/manifest.json") {
            let manifest = await response.json();
            for (let icon of manifest.icons) {
                icon.src = new URL(icon.src, url).href;
            }
            res.send(JSON.stringify(manifest));
        } else {
            res.send(Buffer.from(await response.arrayBuffer()));
        }
    } catch (e) {
        console.error(req.path, e);
        res.status(500);
        if (e instanceof Error) {
            res.send(req.originalUrl + "\n" + e.stack);
        } else {
            res.send(req.originalUrl + "\n" + (e?.message || e?.name || e));
        }
    }
});

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});
