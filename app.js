import express from "express";
import {JSDOM} from "jsdom";
import {withCache} from "ultrafetch";

import * as fs from "fs";


fetch = withCache(fetch);

const malsync = fs.readFileSync("./malsync.recast.user.js");

(async () => {
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
    const jquery = await (await fetch("https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js")).text();

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
        if (url1.pathname.startsWith("/fetch/")) return url1.pathname + url1.search + url1.hash;
        if (["https://malsync.moe", "https://mangadex.org", "https://auth.mangadex.org"].includes(url2.origin)) {
            // if (url2.pathname.startsWith("/pwa/") !== dstURL.pathname.startsWith("/pwa/")) {
            //     return anchorMode ? url2.href : `/fetch/${url2}`;
            // }
            return (url1.pathname || srcURL.origin) + url1.search + url1.hash;
        }
        return (anchorMode || url1.origin === srcURL.origin || isLocalNetwork(url2.hostname)) ? url2.href : `/fetch/${url2}`;
    }

    function transformElement(element, srcURL, dstURL) {
        try {
            if (element.href) {
                let anchorMode = element.tagName.toLowerCase() === "a";
                element.href = transformURL(element.href, srcURL, dstURL, anchorMode);
                if (anchorMode && new URL(element.href, srcURL).origin === srcURL.origin && element.target === "_blank") {
                    element.removeAttribute("target");
                }
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
        let malsyncScript = document.createElement("script");
        malsyncScript.src = `/malsync.user.js?${new URLSearchParams({
            url: dstURL
        })}`;
        document.head.appendChild(malsyncScript);
    }

    app.get("/malsync.user.js", ({query: {url}}, res) => {
        res.contentType("application/json").send(String.raw`
        const __userscript_location__ = window.__userscript_location__ = document.__userscript_location__ = new URL(${JSON.stringify(url)});
        ${jquery}
        ${userscriptPolyfill}
        (async () => {
            let callback = await __polyfill_loader__;
            ${malsync}
        })();
    `);
    });

    app.all("*", async (req, res) => {
        try {
            let srcURL = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`);
            let dstURL = /^\/pwa\/(?!icons\/|screenshots\/|shotcuts\/)|^\/icons\/|^\/js\/|^\/css\/|^\/(?:\w+\/)?oauth\b/.test(req.path) ?
                new URL(req.originalUrl, "https://malsync.moe") :
                /^\/realms\/|^\/resources\//.test(req.path) ?
                    new URL(req.originalUrl, "https://auth.mangadex.org") :
                    req.path.startsWith("/fetch/") ?
                        new URL(req.originalUrl.substring("/fetch/".length)) :
                        new URL(req.originalUrl, "https://mangadex.org");
            let response = await fetch(dstURL, {
                rejectUnauthorized: false,
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
                // let manifest = document.querySelector('meta[rel="manifest"]');
                // if (manifest) manifest.href = "/pwa/manifest.json";
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
            } else if ([
                "https://mangadex.org/manifest.webmanifest",
                "https://malsync.moe/pwa/manifest.json"
            ].includes(dstURL.href)) {
                let manifest = await response.json();
                manifest.start_url = transformURL(manifest.start_url, srcURL, dstURL);
                (function changeSrcs(object) {
                    for (let [key, value] of Object.entries(object)) {
                        if (value instanceof Object) {
                            changeSrcs(value);
                        } else if (typeof value == "string" && ["src", "url", "start_url"].includes(key)) {
                            object[key] = transformURL(value, srcURL, dstURL);
                        }
                    }
                })(manifest);
                res.send(JSON.stringify(manifest));
            } else if (dstURL.href === "https://auth.mangadex.org/realms/mangadex/.well-known/openid-configuration") {
                let config = await response.json();
                (function changeSrcs(object) {
                    for (let [key, value] of Object.entries(object)) {
                        if (value instanceof Object) {
                            changeSrcs(value);
                        } else if (typeof value == "string") {
                            try {
                                object[key] = new URL(transformURL(new URL(value), srcURL, dstURL), srcURL);
                            } catch (e) {
                            }
                        }
                    }
                })(config);
                res.send(JSON.stringify(config));
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
})();
