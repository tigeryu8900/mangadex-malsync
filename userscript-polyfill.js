if (__userscript_location__.origin === "https://malsync.moe") {
    $(document).on("mouseover mouseout", function (e) {
        let target = $(e.target ?? e.srcElement ?? window.target);
        if (e.hasOwnProperty("originalEvent")) {
            e.stopPropagation();
            target.on(e.type);
            setTimeout(() => target.toggleClass('hovering', e.type === 'mouseover'), 0);
        }
    });
    $(document).on("click", function (e) {
        let target = $(e.target ?? e.srcElement ?? window.target);
        let hovering = $('.hovering');
        if (target[0] !== hovering[0] && e.hasOwnProperty("originalEvent")) {
            console.log("trusted", e);
            e.stopPropagation();
            console.log("click", hovering, e);
            (hovering[0] ?? target[0]).dispatchEvent(new Event("click"));
        } else {
            console.log("click ignore", e);
        }
    });
}

let __polyfill_loader__ = (async () => {
    console.log("standalone");

    const prefix = "__userscript__.data.";
    const requirePrefix = "__userscript__.require.";
    const resourcePrefix = "__userscript__.resource.";

    function isLocalNetwork(hostname = location.hostname) {
        return ['localhost', '127.0.0.1', '', '::1'].includes(hostname)
        || hostname.startsWith('192.168.')
        || hostname.startsWith('10.')
        || hostname.endsWith('.local');
    }

    window.transformURL = function transformURL(resource, anchorMode = false) {
        let url1 = new URL(resource, location);
        let url2 = new URL(resource, __userscript_location__);
        if (url1.pathname.startsWith("/fetch/")) return url1.href;
        if (["https://malsync.moe", "https://mangadex.org", "https://auth.mangadex.org"].includes(url2.origin)) {
            // if (url2.pathname.startsWith("/pwa/") !== __userscript_location__.pathname.startsWith("/pwa/")) {
            //     return anchorMode ? url2.href : `/fetch/${url2}`;
            // }
            return location.origin + url1.pathname + url1.search + url1.hash;
        }
        return (anchorMode || url1.origin === location.origin || isLocalNetwork(url2.hostname)) ? url2.href : `${location.origin}/fetch/${url2}`;
    }

    const oldFetch = fetch;
    fetch = window.fetch = function (resource, options) {
        return oldFetch.call(this, transformURL(resource), options);
    }

    const oldOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
        return oldOpen.call(this, method, transformURL(url), async, user, password);
    };

    function generateUUID() {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    function transformElement(element) {
        try {
            element.__userscript_transformed__ = true;
            if (element.href) {
                let anchorMode = element.tagName.toLowerCase() === "a";
                element.href = transformURL(element.href, anchorMode);
                if (anchorMode && new URL(element.href, location).origin === location.origin && element.target === "_blank") {
                    element.removeAttribute("target");
                }
            }
            if (element.src) {
                element.src = transformURL(element.src);
            }
        } catch (e) {
            console.error(e);
        }
    }

    try {
        let insertPWALink = __userscript_location__.origin === "https://mangadex.org";
        let leftPWALink = $(String.raw`
            <a data-v-69037ae7="" data-v-eba09a86="" href="/pwa/" class="flex-shrink-0" title="">
                <div data-v-eba09a86="" class="px-4 pt-2 flex flex-col flex-shrink-0">
                    <div data-v-abcd45c8="" data-v-eba09a86="" class="list__item">
                        <div data-v-abcd45c8="">
                            <img data-v-4c681a64=""
                                    data-v-abcd45c8=""
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="24"
                                    height="24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    class="feather feather-book-open icon"
                                    viewBox="0 0 24 24"
                                    style="color: currentcolor;"
                                    src="/icons/mal-sync-icon.svg">
                        </div>
                        <div data-v-abcd45c8="" class="mx-2 font-bold">MALSync</div>
                    </div>
                </div>
            </a>
        `);
        let rightPWALink = $(String.raw`
            <a data-v-a31e942f=""
               data-v-c1dca64c=""
               class="list__item mt-1 rounded custom-opacity relative md-btn flex items-center px-3 overflow-hidden accent text px-4 list__item mt-1"
               style="min-height: 3rem; min-width: 100%;"
               href="/pwa/">
                <span data-v-a31e942f=""
                      class="flex relative items-center justify-center font-medium select-none w-full"
                      style="pointer-events: none; justify-content: stretch;">
                    <div data-v-c1dca64c="" class="flex justify-between items-center w-full">
                        <span data-v-c1dca64c="" class="mr-1 whitespace-nowrap">MALSync</span>
                        <img data-v-4c681a64=""
                                data-v-abcd45c8=""
                                xmlns="http://www.w3.org/2000/svg"
                                width="24" height="24" fill="none"
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round" 
                                stroke-width="2"
                                class="feather feather-book-open icon"
                                viewbox="0 0 24 24"
                                style="color: currentcolor;"
                                src="/icons/mal-sync-icon.svg">
                    </div>
                </span>
            </a>
        `);
        const observer = new (MutationObserver || WebkitMutationObserver)(mutationList => {
            for (const mutation of mutationList) {
                if (mutation.type === "childList") {
                    if (insertPWALink) {
                        let home = $('#section-Home:not([__userscript_transformed__])');
                        if (home.length) {
                            home.attr("__userscript_transformed__", "");
                            leftPWALink.insertAfter(home);
                        }
                        let grid = $('div:is(.drawer, .profile__container) > div > div.grid:not([__userscript_transformed__])');
                        if (grid.length) {
                            grid.attr("__userscript_transformed__", "");
                            rightPWALink.insertAfter(grid);
                        }
                    }
                    for (let element of mutation.addedNodes) {
                        if (!element.__userscript_transformed__) {
                            transformElement(element);
                            for (let descendent of $(element).find('[href], [src]')) {
                                transformElement(descendent);
                            }
                        }
                    }
                    $(':not(:has(*)):contains("Could not connect to the reCAPTCHA service. Please check your internet connection and reload to get a reCAPTCHA challenge.")').parent().remove();
                } else if (mutation.type === "attributes") {
                    if (mutation.attributeName === "href" || mutation.attributeName === "src") {
                        if (!mutation.target.__userscript_transformed__) {
                            transformElement(mutation.target);
                        }
                    }
                }
            }
        });
        const config = { attributes: true, childList: true, subtree: true };
        observer.observe(document.documentElement ?? document.body, config);
    } catch (e) {
        console.log(e);
    }

    function blobToBase64(blob) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }

    function GM_addElement(a, b, c) {
        let [parent_node, tag_name, attributes] = (a instanceof Element) ? [a, b, c] : [null, a, b];
        let element = document.createElement(tag_name);
        if (attributes) {
            for (let [key, value] of Object.entries(attributes)) {
                element[key] = value;
            }
        }
        parent_node?.appendChild(element);
    }

    async function addElement(a, b, c) {
        GM_addElement(a, b, c);
    }

    function GM_addStyle(css) {
        GM_addElement(document.head, "style", { textContent: css });
    }

    async function addStyle(css) {
        GM_addStyle(css);
    }

    function GM_download(a, b) {
        let [url, name] = b ? [a, b] : [a.url, a.name ?? ""];
        var link = document.createElement("a");
        link.setAttribute("download", name);
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    async function download(a, b) {
        GM_download(a, b);
    }

    function GM_getResourceText(name) {
        return JSON.parse(localStorage.getItem(resourcePrefix + name) ?? "{}")?.text;
    }

    async function getResourceText(name) {
        return GM_getResourceText(name);
    }

    function GM_getResourceURL(name) {
        return JSON.parse(localStorage.getItem(resourcePrefix + name) ?? "{}")?.url;
    }

    async function getResourceURL(name) {
        return GM_getResourceURL(name);
    }

    function GM_notification() {}

    async function notification() {}

    function GM_openInTab(url, options) {
        open(url, options);
    }

    async function openInTab(url, options) {
        open(url, options);
    }

    function GM_registerMenuCommand(name, callback, options_or_accessKey) {}

    function GM_unregisterMenuCommand(menuCmdId) {}

    async function registerMenuCommand(name, callback, options_or_accessKey) {}

    async function unregisterMenuCommand(menuCmdId) {}

    function GM_setClipboard(data, info, cb) {
        const type = info?.mimetype ?? info?.type ?? "text/plain";
        const blob = new Blob([data], { type });

        navigator.clipboard.write([new ClipboardItem({ [type]: blob })]).then(
            cb ?? (() => {})
        );
    }

    async function setClipboard(data, info, cb) {
        const type = info?.mimetype ?? info?.type ?? "text/plain";
        const blob = new Blob([data], { type });

        return navigator.clipboard.write([new ClipboardItem({ [type]: blob })]).then(
            cb ?? (() => {})
        );
    }

    function GM_getTab(callback) {}

    async function getTab(callback) {}

    function GM_saveTab(callback) {}

    async function saveTab(callback) {}

    function GM_getTabs(callback) {}

    function getTabs(callback) {}

    const valueChangeListenersById = {};
    const valueChangeListenersByKey = {};

    function GM_setValue(key, value) {
        let oldValue = localStorage.getItem(prefix + key);
        localStorage.setItem(prefix + key, JSON.stringify(value));
        if (valueChangeListenersByKey[key]) {
            for (let callback of Object.values(valueChangeListenersByKey[key])) {
                setTimeout(0, () => callback(key, oldValue, value));
            }
        }
    }

    async function setValue(key, value) {
        GM_setValue(key, value);
    }

    function GM_getValue(key, defaultValue) {
        return Object.keys(localStorage).includes(prefix + key) ? JSON.parse(localStorage.getItem(prefix + key)) : defaultValue;
    }

    async function getValue(key, defaultValue) {
        return GM_getValue(key, defaultValue);
    }

    function GM_deleteValue(key) {
        let oldValue = localStorage.getItem(prefix + key);
        localStorage.removeItem(prefix + key);
        if (valueChangeListenersByKey[key]) {
            for (let callback of Object.values(valueChangeListenersByKey[key])) {
                setTimeout(0, () => callback(key, oldValue, value));
            }
        }
    }

    async function deleteValue(key) {
        GM_deleteValue(key);
    }

    function GM_listValues() {
        return Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => key.substring(prefix.length));
    }

    async function listValues() {
        return GM_listValues();
    }

    function GM_addValueChangeListener(key, callback) {
        const listenerId = generateUUID();
        valueChangeListenersById[listenerId] = key;
        if (!valueChangeListenersByKey[key]) {
            valueChangeListenersByKey[listenerId] = {};
        }
        valueChangeListenersByKey[key][listenerId] = callback;
        return listenerId;
    }

    async function addValueChangeListener(key, callback) {
        return GM_addValueChangeListener(key, callback);
    }

    function GM_removeValueChangeListener(listenerId) {
        delete valueChangeListenersByKey[valueChangeListenersById[listenerId]][listenerId];
        delete valueChangeListenersById[listenerId];
    }

    async function removeValueChangeListener(listenerId) {
        return GM_removeValueChangeListener(listenerId);
    }

    function GM_xmlhttpRequest(details) {
        const transformer = {
            arrraybuffer(response) {
                return response.clone().arrayBuffer();
            },
            blob(response) {
                return response.clone().blob();
            },
            json(response) {
                return response.clone().json();
            },
            stream(response) {
                return Promise.resolve(response.clone().body);
            }
        };
        async function transform(response) {
            let text = await response.clone().text();
            return Object.defineProperties({
                finalUrl: response.url,
                readyState: 4,
                status: response.status,
                statusText: response.statusText,
                responseHeaders: response.headers,
                response: details.responseType ? await transformer[details.responseType](response).catch(e => e) : text,
                responseXML: () => new DOMParser().parseFromString(text, "text/xml"),
                responseText: text
            }, {
                responseXML: {
                    get() {
                        return new DOMParser().parseFromString(text, "text/xml");
                    }
                }
            });
        }
        if (details.fetch) {
            let controller = new AbortController();
            let headers = Object.fromEntries(
                Object.entries(details.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
            );
            let fulfilled = false;
            let promise = fetch(details.url, {
                method: details.method,
                signal: controller.signal,
                headers: {
                    ...headers,
                    ...details.overrideMimeType ? {
                        "content-type": details.overrideMimeType
                    } : {},
                    ...(details.user ?? details.password) ? {
                        authorization: "basic " + btoa((details.user ?? "") + ":" + (details.password ?? ""))
                    } : {},
                    ...details.anonymous ? {} : {
                        cookie: [headers.cookie ?? document.cookie, details.cookie].filter(e => e).join("; ")
                    }
                },
                body: details.data,
            }).then(async response => {
                let transformed = await transform(response);
                if (details.onloadstart) details.onloadstart(transformed);
                if (details.onprogress) details.onprogress(transformed);
                if (details.onload) details.onload(transformed);
                return transformed;
            }, response => {
                if (details.onerror) details.onerror(response);
                return new Response();
            }).then(transformed => {
                fulfilled = true;
                if (details.onreadystatechange) details.onreadystatechange(transformed);
                if (details.onloadend) details.onloadend(transformed);
            });
            if (details.timeout) {
                setTimeout(details.timeout, () => {
                    if (!fulfilled) {
                        if (details.ontimeout) details.ontimeout();
                        controller.abort();
                    }
                });
            }
            promise.abort = () => {
                if (details.onabort) details.onabort();
                controller.abort();
            };
            return promise;
        } else {
            let xhr = new XMLHttpRequest();
            xhr.open(details.method ?? "GET", details.url);
            if (details.timeout) xhr.timeout = details.timeout;
            if (details.responseType) xhr.responseType = details.responseType;
            let headers = Object.fromEntries(
                Object.entries(details.headers ?? {}).map(([key, value]) => [key.toLowerCase(), value])
            );
            for (let [key, value] of Object.entries({
                ...headers,
                ...details.overrideMimeType ? {
                    "content-type": details.overrideMimeType
                } : {},
                ...(details.user ?? details.password) ? {
                    authorization: "basic " + btoa((details.user ?? "") + ":" + (details.password ?? ""))
                } : {}
            })) {
                try {
                    xhr.setRequestHeader(key, value);
                } catch (e) {
                    console.error(e);
                }
            }
            if (details.overrideMimeType) xhr.overrideMimeType(details.overrideMimeType);
            if (details.onabort) xhr.addEventListener("abort", () => details.onabort(xhr));
            if (details.onerror) xhr.addEventListener("error", () => details.onerror(xhr));
            if (details.onload) xhr.addEventListener("load", () => details.onload(xhr));
            if (details.onloadend) xhr.addEventListener("loadend", () => details.onloadend(xhr));
            if (details.onloadstart) xhr.addEventListener("loadstart", () => details.onloadstart(xhr));
            if (details.onprogress) xhr.addEventListener("progress", () => details.onprogress(xhr));
            if (details.onreadystatechange) xhr.addEventListener("readystatechange", () => details.onreadystatechange(xhr));
            if (details.ontimeout) xhr.addEventListener("timeout", () => details.ontimeout(xhr));
            xhr.send(details.data);
            let promise = new Promise((resolve, reject) => {
                xhr.addEventListener("load", () => resolve(xhr));
                xhr.addEventListener("abort", () => reject(xhr));
                xhr.addEventListener("error", () => reject(xhr));
                xhr.addEventListener("timeout", () => reject(xhr));
            });
            promise.abort = () => xhr.abort();
            return promise;
        }
    }

    function xmlhttpRequest(details) {
        return GM_xmlhttpRequest(details);
    }

    Object.assign(window, {
        GM_addElement,
        GM_addStyle,
        GM_download,
        GM_getResourceText,
        GM_getResourceURL,
        GM_notification,
        GM_openInTab,
        GM_registerMenuCommand,
        GM_unregisterMenuCommand,
        GM_setClipboard,
        GM_getTab,
        GM_saveTab,
        GM_getTabs,
        GM_setValue,
        GM_getValue,
        GM_deleteValue,
        GM_listValues,
        GM_addValueChangeListener,
        GM_removeValueChangeListener,
        GM_xmlhttpRequest,
        GM: {
            addElement,
            addStyle,
            download,
            getResourceText,
            getResourceURL,
            notification,
            openInTab,
            registerMenuCommand,
            unregisterMenuCommand,
            setClipboard,
            getTab,
            saveTab,
            getTabs,
            setValue,
            getValue,
            deleteValue,
            listValues,
            addValueChangeListener,
            removeValueChangeListener,
            xmlhttpRequest
        }
    });

    return async scriptMetaStr => {
        if (scriptMetaStr) {
            const GM_info = window.GM_info = window.GM.info = {
                scriptHandler: "userscript-polyfill",
                scriptMetaStr,
                scriptUpdateURL: null,
                version: null,
                script: {
                    antifeatures: {},
                    author: null,
                    connects: [],
                    copyright: null,
                    description: null,
                    description_i18n: {},
                    downloadURL: null,
                    excludes: [],
                    grant: [],
                    header: scriptMetaStr,
                    homepage: null,
                    icon: null,
                    icon64: null,
                    includes: [],
                    matches: [],
                    name: null,
                    name_i18n: {},
                    namespace: null,
                    resources: [],
                    supportURL: null,
                    "run-at": null,
                    unwrap: null,
                    updateURL: null,
                    version: null
                }
            };
            await Promise.all([...scriptMetaStr.matchAll(/@([^\s:]+)(?::(\S+))?(?:[^\S\n]+(.+?))?\s*?\n/g)].map(async ([, name, locale, value]) => {
                switch (name) {
                    case "antifeature": {
                        let [k, v] = value.split(/(?<=^\S*)\s+/);
                        GM_info.script.antifeature[k] = v;
                    } break;
                    case "author":
                        GM_info.script.author = value;
                        break;
                    case "connect":
                        GM_info.script.connects.push(value);
                        break;
                    case "copyright":
                        GM_info.script.copyright = value;
                        break;
                    case "description":
                        locale ? (GM_info.script.description_i18n[locale] = value) : (GM_info.script.description = value);
                        break;
                    case "downloadURL":
                        GM_info.script.downloadURL = value;
                        break;
                    case "exclude":
                        GM_info.script.excludes.push(value);
                        break;
                    case "grant":
                        GM_info.script.grant.push(value);
                        break;
                    case "homepage":
                        GM_info.script.homepage = value;
                        break;
                    case "icon":
                    case "iconURL":
                    case "defaulticon":
                        GM_info.script.icon = value;
                        break;
                    case "icon64":
                    case "icon64URL":
                        GM_info.script.icon64 = value;
                        break;
                    case "include":
                        GM_info.script.includes.push(value);
                        break;
                    case "match":
                        GM_info.script.matches.push(value);
                        break;
                    case "name":
                        locale ? (GM_info.script.name_i18n[locale] = value) : (GM_info.script.name = value);
                        break;
                    case "namespace":
                        GM_info.script.namespace = value;
                        break;
                    case "resource": {
                        GM_info.script.resources.push(await new Promise(async resolve => {
                            let [name, url] = value.split(/\s+/);
                            if (Object.keys(localStorage).includes(resourcePrefix + name)) {
                                let { url: uri, text: content } = JSON.parse(localStorage.getItem(resourcePrefix + name) ?? "{}");
                                let meta = (uri?.match(/(?<=^data:).*?(?=;)/) ?? [])[0];
                                resolve({ content, meta, name, url });
                            } else {
                                GM_xmlhttpRequest({
                                    fetch: true,
                                    responseType: "blob",
                                    method: "GET",
                                    url,
                                    async onload(response) {
                                        let uri = await blobToBase64(response.response);
                                        let content = response.responseText;
                                        let meta = (uri?.match(/(?<=^data:).*?(?=;)/) ?? [])[0];
                                        localStorage.setItem(resourcePrefix + name, JSON.stringify({ url: uri, text: content }));
                                        resolve({ content, meta, name, url });
                                    }
                                });
                            }
                        }));
                    } break;
                    case "require": {
                        let script = await new Promise(async resolve => {
                            let data = Object.keys(localStorage).includes(requirePrefix + value);
                            if (data) {
                                resolve(data);
                            } else {
                                GM_xmlhttpRequest({
                                    method: "GET",
                                    url: value,
                                    onload(response) {
                                        localStorage.setItem(requirePrefix + name, response.responseText);
                                        resolve(response.responseText);
                                    }
                                });
                            }
                        });
                        try {
                            // eslint-disable-next-line no-useless-call, no-eval
                            eval.call(null, script + "\n" + script.match(/(?<=class\s+)[a-zA-Z_$][\w]*/g)?.map(name => "window." + name + " = " + name + ";").join("\n"));
                        } catch (e) {
                            console.error(e);
                        }
                    } break;
                    case "supportURL":
                        GM_info.script.supportURL = value;
                        break;
                    case "run-at":
                        GM_info.script["run-at"] = !!value;
                        break;
                    case "updateURL":
                        GM_info.scriptUpdateURL = GM_info.script.updateURL = value;
                        break;
                    case "version":
                        GM_info.version = GM_info.script.version = value;
                        break;
                }
            }));
        }
    };
})();
