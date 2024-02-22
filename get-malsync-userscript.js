import * as babel from "@babel/core";
import fs from "node:fs/promises";

const userscript_location = "__userscript_location__";

(async () => {
    let jqueryPromise = fetch("https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js")
        .then(response => response.text());
    let polyfillPromise = fs.readFile("./userscript-polyfill.js")
        .then(buffer => buffer.toString());
    let code = (await (await fetch("https://github.com/MALSync/MALSync/releases/latest/download/malsync.user.js")).text())
        .replace(/\/\/\s*==UserScript==[\s\S]+?\/\/\s*==\/UserScript==/, str => String.raw`
            await callback(${JSON.stringify(str)});
        `.replaceAll("$", "$$$$"));

    let transformed = babel.transform(code, {
        presets: ["@babel/preset-env"],
        minified: true,
        sourceType: "unambiguous",
        plugins: [
            {
                visitor: {
                    MemberExpression(path) {
                        if (["location.host", "location.hostname", "location.href", "location.origin"].some(pattern => path.matchesPattern(pattern))) {
                            path.get("object").replaceWith(babel.types.identifier(userscript_location));
                            path.skip();
                        } else if (["document.location", "window.location"].some(pattern => path.matchesPattern(pattern))) {
                            path.replaceWith(babel.types.identifier(userscript_location));
                            path.skip();
                        }
                    },
                    IfStatement(path) {
                        if (/!\s*firstData\s*\.\s*hasOwnProperty\s*\(.*?\)/.test(path.get("test").getSource())) {
                            path.replaceWith(babel.types.emptyStatement());
                            path.skip();
                        }
                    },
                    CallExpression(path) {
                        if (path.get("callee").isIdentifier({ name: "alert" }) && path.get("arguments")[0].isStringLiteral({ value: "File imported" })) {
                            path.replaceWithSourceString('alert("File imported"), window.location.reload()');
                            path.skip();
                        }
                    }
                }
            }
        ],
    });

    await fs.writeFile("./malsync.user.js", String.raw`
        const __userscript_location__ = window.__userscript_location__ = document.__userscript_location__ = new URL(__URL_PLACEHOLDER__);
        ${await jqueryPromise}
        ${await polyfillPromise}
        (async () => {
            let callback = await __polyfill_loader__;
            ${transformed.code}
        })();
    `);
    process.exit();
})();
