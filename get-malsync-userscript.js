import * as parser from "@babel/parser";
import * as recast from "recast";
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

    let ast = recast.parse(code, {parser});

    recast.visit(ast, {
        visitMemberExpression(path) {
            if (path.value.object.type === "Identifier") {
                if (path.value.object.name === "location") {
                    if (path.value.property.type === "Identifier" && ["host", "hostname", "href", "origin"].includes(path.value.property.name)) {
                        path.value.object.name = userscript_location;
                        return false;
                    } else if (path.value.property.type === "StringLiteral" && ["host", "hostname", "href", "origin"].includes(path.value.property.value)) {
                        path.value.object.name = userscript_location;
                        return false;
                    }
                } else if (["document", "window"].includes(path.value.object.name)) {
                    if (path.value.property.type === "Identifier") {
                        if (path.value.property.name === "location") {
                            path.value.property.name = userscript_location;
                        }
                        return false;
                    } else if (path.value.property.type === "StringLiteral") {
                        if (path.value.property.value === "location") {
                            path.value.property.value = userscript_location;
                        }
                        return false;
                    }
                }
            }
            this.traverse(path);
        }, visitIfStatement(path) {
            if (path.value.test.type === "UnaryExpression" && path.value.test.operator === "!" && path.value.test.argument.type === "CallExpression" && path.value.test.argument.callee.type === "MemberExpression" && path.value.test.argument.callee.object.type === "Identifier" && path.value.test.argument.callee.object.name === "firstData" && ((path.value.test.argument.callee.property.type === "StringLiteral" && path.value.test.argument.callee.property.value === "hasOwnProperty") || (path.value.test.argument.callee.property.type === "Identifier" && path.value.test.argument.callee.property.name === "hasOwnProperty"))) {
                path.value.test = recast.types.builders.literal(false);
            }
            this.traverse(path);
        }, visitCallExpression(path) {
            if (path.value.callee.name === "alert" && path.value.arguments[0] && path.value.arguments[0].type === "StringLiteral" && path.value.arguments[0].value === "File imported") {
                Object.keys(path.value).forEach(key => delete path.value[key]);
                Object.assign(path.value, parser.parse('alert("File imported"), window.location.reload()').program.body[0].expression);
                return false;
            }
            this.traverse(path);
        }
    });

    await fs.writeFile("./malsync.user.js", String.raw`
        const __userscript_location__ = window.__userscript_location__ = document.__userscript_location__ = new URL(__URL_PLACEHOLDER__);
        ${await jqueryPromise}
        ${await polyfillPromise}
        (async () => {
            let callback = await __polyfill_loader__;
            ${recast.print(ast).code}
        })();
    `);
    process.exit();
})();
