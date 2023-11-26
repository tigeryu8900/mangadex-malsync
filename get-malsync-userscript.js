import * as recast from "recast";
import * as parser from "recast/parsers/babel.js";
import fs from "fs";


const userscript_location = "__userscript_location__";

(async () => {
    let code = await (await fetch("https://github.com/MALSync/MALSync/releases/latest/download/malsync.user.js")).text();

    code = code.replace(/\/\/\s*==UserScript==[\s\S]+?\/\/\s*==\/UserScript==/, str => String.raw`
        await callback(${JSON.stringify(str)});
    `.replaceAll("$", "$$$$"));

    let ast = recast.parse(code, {parser});

    recast.visit(ast, {
        visitMemberExpression(path) {
            if (path.value.object.type === "Identifier") {
                if (path.value.object.name === "location") {
                    if (path.value.property.type === "Identifier" && [
                        "host",
                        "hostname",
                        "href",
                        "origin"
                    ].includes(path.value.property.name)) {
                        path.value.object.name = userscript_location;
                        return false;
                    } else if (path.value.property.type === "StringLiteral" && [
                        "host",
                        "hostname",
                        "href",
                        "origin"
                    ].includes(path.value.property.value)) {
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
        },
        visitIfStatement(path) {
            if (path.value.test.type === "UnaryExpression" &&
                path.value.test.operator === "!" &&
                path.value.test.argument.type === "CallExpression" &&
                path.value.test.argument.callee.type === "MemberExpression" &&
                path.value.test.argument.callee.object.type === "Identifier" &&
                path.value.test.argument.callee.object.name === "firstData" &&
                (
                    (
                        path.value.test.argument.callee.property.type === "StringLiteral" &&
                        path.value.test.argument.callee.property.value === "hasOwnProperty"
                    ) ||
                    (
                        path.value.test.argument.callee.property.type === "Identifier" &&
                        path.value.test.argument.callee.property.name === "hasOwnProperty"
                    )
                )
            ) {
                path.value.test = recast.types.builders.literal(false);
            }
            this.traverse(path);
        }
    });

    fs.writeFileSync("./malsync.recast.user.js", recast.prettyPrint(ast).code);
})();
