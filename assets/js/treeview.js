/* shorthand functions (createElement is defined at bottom)*/
const div = (props, ...children) => createElement("div", props, ...children);
const ul = (props, ...children) => createElement("ul", props, ...children);
const li = (props, ...children) => createElement("li", props, ...children);
const i = (props, ...children) => createElement("i", props, ...children);
const span = (props, ...children) => createElement("span", props, ...children);
const header = (props, ...children) =>
    createElement("header", props, ...children);
const p = (props, ...children) => createElement("p", props, ...children);
const section = (props, ...children) =>
    createElement("section", props, ...children);
const button = (props, ...children) =>
    createElement("button", props, ...children);

const fileTypeIcons = {
    // Code Files
    js: "code",
    json: "description",
    css: "style",
    html: "language",
    xml: "code",
    jsx: "code",
    ts: "code",
    tsx: "code",
    php: "code",
    py: "code",
    rb: "code",
    java: "code",
    cpp: "code",
    c: "code",
    cs: "code",
    swift: "code",
    go: "code",
    rs: "code", // Rust
    r: "code", // R

    // Image Files
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    bmp: "image",
    svg: "image",
    webp: "image",
    tiff: "image",

    // Document Files
    md: "article",
    txt: "article",
    pdf: "picture_as_pdf",
    doc: "description",
    docx: "description",
    xls: "description",
    xlsx: "description",
    csv: "description",
    ppt: "description",
    pptx: "description",
    odt: "description", // OpenDocument Text
    ods: "description", // OpenDocument Spreadsheet
    odp: "description", // OpenDocument Presentation
    rtf: "description", // Rich Text Format

    // Audio Files
    mp3: "audiotrack",
    wav: "audiotrack",
    ogg: "audiotrack",
    flac: "audiotrack",
    aac: "audiotrack",

    // Video Files
    mp4: "videocam",
    mkv: "videocam",
    webm: "videocam",
    avi: "videocam",
    mov: "videocam",
    wmv: "videocam",
    flv: "videocam",

    // Archive Files
    zip: "archive",
    rar: "archive",
    tar: "archive",
    gz: "archive",
    bz2: "archive",
    "7z": "archive",

    // Executable Files
    exe: "computer",
    msi: "computer",
    sh: "terminal",
    bat: "terminal",

    // Fonts
    ttf: "font_download",
    otf: "font_download",
    woff: "font_download",
    woff2: "font_download",
    
    // Others
    pt: "memory",

    // Default
    default: "insert_drive_file"
};

function getFileIcon(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    return fileTypeIcons[extension] || fileTypeIcons.default;
}


/* File */

const File = ({ name }) => {
    return div(
        { className: "file" },
        i({ className: "material-icons", style: "opacity: 0;" }, "arrow_right"),
        i({ className: "material-icons" }, getFileIcon(name)),
        span(null, name)
    );
};

/* Folder */

const openedFolderIcon = "folder_open";
const closedFolderIcon = "folder";
const openedArrowIcon = "arrow_drop_down";
const closedArrowIcon = "arrow_right";

function changeOpened(event) {
    const folderHeader = event.target.classList.contains("folder-header")
        ? event.target
        : event.target.parentElement;
    const opened = folderHeader.getAttribute("opened") == "true";
    const newOpened = !opened;

    let icons = folderHeader.querySelectorAll(".material-icons");
    icons.forEach(icon => {
        if (/arrow/i.test(icon.textContent)) {
            icon.textContent = newOpened ? openedArrowIcon : closedArrowIcon;
        } else {
            icon.textContent = newOpened ? openedFolderIcon : closedFolderIcon;
        }
    });

    try {
        const sibling = folderHeader.nextElementSibling;
        if (newOpened) {
            sibling.classList.remove("hide");
        } else {
            sibling.classList.add("hide");
        }
    } catch (e) {
        console.warn(`No sibling of elem ${folderHeader} found ...`);
    }

    folderHeader.setAttribute("opened", newOpened);
}

const Folder = (props, ...children) => {
    const opened = props.opened || false;
    const arrowIcon = opened ? openedArrowIcon : closedArrowIcon;
    const folderIcon = opened ? openedFolderIcon : closedFolderIcon;
    const folderName = props.name || "unknown";

    return div(
        { className: "folder" },
        header(
            {
                onClick: changeOpened,
                className: "folder-header",
                opened: opened
            },
            i({ className: "material-icons" }, arrowIcon),
            i({ className: "material-icons" }, folderIcon),
            span(null, folderName)
        ),
        ul({ className: opened ? "" : "hide" }, ...children)
    );
};

/* My react-clone mini library */
function appendChildren(parent, children) {
    for (let child of children) {
        if (!child) continue;
        switch (typeof child) {
            case "string":
                const el = document.createTextNode(child);
                parent.appendChild(el);
                break;
            default:
                parent.appendChild(child);
                break;
        }
    }
}
function setStyle(el, style) {
    if (typeof style == "string") {
        el.setAttribute("style", style);
    } else {
        Object.assign(el.style, style);
    }
}
function setClass(el, className) {
    className.split(/\s/).forEach(element => {
        if (element) {
            el.classList.add(element);
        }
    });
}
function setProps(el, props) {
    const eventRegex = /^on([a-z]+)$/i;
    for (let propName in props) {
        if (!propName) continue;

        if (propName === "style") {
            setStyle(el, props[propName]);
        } else if (propName === "className") {
            setClass(el, props[propName]);
        } else if (eventRegex.test(propName)) {
            const eventToListen = propName.replace(eventRegex, "$1").toLowerCase();
            el.addEventListener(eventToListen, props[propName]);
        } else {
            el.setAttribute(propName, props[propName]);
        }
    }
}

//type, [props], [...children]
function createElement(type, props, ...children) {
    if (typeof type === "function") {
        return type(props);
    } else {
        const el = document.createElement(type);
        if (props && typeof props === "object") {
            setProps(el, props);
        }
        if (children) {
            appendChildren(el, children);
        }
        return el;
    }
}