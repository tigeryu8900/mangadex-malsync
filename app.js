import express from "express";
import {JSDOM} from "jsdom";
import * as fs from "fs";

const app = express();
app.use(function (req, res, next) {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", function (chunk) {
        data += chunk;
    });

    req.on("end", function () {
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

function isLocalNetwork(hostname) {
    return ['localhost', '127.0.0.1', '', '::1'].includes(hostname)
        || hostname.startsWith('192.168.')
        || hostname.startsWith('10.')
        || hostname.endsWith('.local');
}

function transformURL(resource, srcURL, dstURL, anchorMode = false) {
    let url1 = new URL(resource, srcURL);
    let url2 = new URL(resource, dstURL);
    if (url1.pathname.startsWith("/fetch/")) return url1.pathname + url1.hash;
    if (url2.origin === dstURL.origin) {
        if (url2.pathname.startsWith("/pwa/") !== dstURL.pathname.startsWith("/pwa/")) {
            return anchorMode ? url2.href : `/fetch/${url2}`;
        }
        return (url1.pathname || srcURL.origin) + url1.hash;
    }
    return (anchorMode || url1.origin === srcURL.origin || isLocalNetwork(url2.hostname)) ? url2.href : `/fetch/${url2}`;
}

function transformElement(element, srcURL, dstURL) {
    try {
        if (element.href) {
            element.href = transformURL(element.href, srcURL, dstURL, element.tagName.toLowerCase() === "a");
        }
        if (element.src) {
            element.src = transformURL(element.src, srcURL, dstURL);
        }
    } catch (e) {
        console.error(e);
    }
}

async function injectMalsync(document, srcURL, dstURL) {
    for (let element of document.querySelectorAll('[href], [src]')) {
        transformElement(element, srcURL, dstURL);
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
        let srcURL = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
        let dstURL = req.path.startsWith("/pwa/") ?
            new URL(req.originalUrl, "https://malsync.moe") :
            req.path.startsWith("/fetch/") ?
                new URL(req.originalUrl.substring("/fetch/".length)) :
                new URL(req.originalUrl, "https://mangadex.org");
        let response = await fetch(dstURL, {
            method: req.method,
            headers: {
                ...req.headers,
                referer: dstURL.origin,
                referrer: dstURL.origin,
                origin: dstURL.origin,
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
            let document = dom.window.document;
            if (req.path.startsWith("/pwa/")) {
                // <meta name="apple-mobile-web-app-capable" content="yes">
                // <link rel="icon" type="image/png" sizes="128x128" href="https://raw.githubusercontent.com/MALSync/MALSync/master/assets/icons/icon128.png">
                // <link rel="apple-touch-icon" href="https://raw.githubusercontent.com/MALSync/MALSync/master/assets/icons/icon128.png">
                let mobileCapable = document.createElement("meta");
                mobileCapable.name = "apple-mobile-web-app-capable";
                mobileCapable.content = "yes";
                document.head.appendChild(mobileCapable);
                let icon = document.createElement("link");
                icon.rel = "icon";
                icon.type = "image/png";
                icon.setAttribute("sizes", "128x128")
                icon.href = "https://raw.githubusercontent.com/MALSync/MALSync/master/assets/icons/icon128.png";
                document.head.appendChild(icon);
                let appleIcon = document.createElement("link");
                appleIcon.rel = "apple-touch-icon";
                appleIcon.href = "https://raw.githubusercontent.com/MALSync/MALSync/master/assets/icons/icon128.png";
                document.head.appendChild(appleIcon);
            }
            await injectMalsync(document, srcURL, dstURL);
            res.send(dom.serialize());
        } else if (dstURL.href === "https://malsync.moe/pwa/manifest.json") {
            let manifest = await response.json();
            for (let icon of manifest.icons) {
                icon.src = new URL(icon.src, dstURL).href;
            }
            res.send(JSON.stringify(manifest));
        } else if (dstURL.href === "https://mangadex.org/manifest.webmanifest") {
            let manifest = await response.json();
            manifest.start_url = transformURL(manifest.start_url, srcURL, dstURL);
            (function changeSrcs(object) {
                for (let [key, value] of Object.entries(object)) {
                    if (value instanceof Object) {
                        changeSrcs(value);
                    } else if (key === "src") {
                        object[key] = transformURL(value, srcURL, dstURL);
                    }
                }
            })(manifest);
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
