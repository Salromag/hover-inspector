(() => {
    let enabled = false;
    let root, marginBox, paddingBox, contentBox, tooltip;
    let lastTarget = null;
    let rafId = null;

    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.type === "PING") return sendResponse({ ok: true });

        if (msg.type === "GET_STATE") {
            sendResponse({ enabled });
            return true;
        }

        if (msg.type === "TOGGLE_ASSISTANT") {
            enabled ? disable() : enable();
            sendResponse({ enabled });
            return true;
        }
    });

    function enable() {
        if (enabled) return;
        enabled = true;
        buildOverlay();
        window.addEventListener("mousemove", onMove, true);
        window.addEventListener("scroll", onRepaint, true);
        window.addEventListener("resize", onRepaint, true);
        window.addEventListener("click", onClick, true);
        console.log("[UI Assistant] overlay enabled");
    }

    function disable() {
        if (!enabled) return;
        enabled = false;
        destroyOverlay();
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("scroll", onRepaint, true);
        window.removeEventListener("resize", onRepaint, true);
        window.removeEventListener("click", onClick, true);
        lastTarget = null;
        if (rafId) cancelAnimationFrame(rafId);
        console.log("[UI Assistant] overlay disabled");
    }

    function buildOverlay() {
        root = document.createElement("div");
        Object.assign(root.style, {
            position: "fixed",
            left: 0,
            top: 0,
            width: "100vw",
            height: "100vh",
            pointerEvents: "none",
            zIndex: "2147483647"
        });

        marginBox = makeLayer("rgba(255, 170, 0, .25)", "1px solid rgba(255,170,0,.8)");
        paddingBox = makeLayer("rgba(80, 220, 120, .25)", "1px solid rgba(80,220,120,.8)");
        contentBox = makeLayer("rgba(120, 170, 210, .25)", "1px solid rgba(120,170,210,.8)");

        tooltip = document.createElement("div");
        Object.assign(tooltip.style, {
            position: "fixed",
            color: "#e5e7eb",
            font: "12px/1.3 system-ui, sans-serif",
            borderRadius: "6px",
            padding: "12px",
            pointerEvents: "none",
            maxWidth: "60vw",
            whiteSpace: "pre-wrap",
            lineHeight: "1.4",
        });

        root.append(marginBox, paddingBox, contentBox, tooltip);
        document.body.appendChild(root);
    }

    function destroyOverlay() {
        if (root) root.remove();
        root = marginBox = paddingBox = contentBox = tooltip = null;
    }

    function makeLayer(bg, border) {
        const el = document.createElement("div");
        Object.assign(el.style, {
            position: "fixed",
            background: bg,
            border: border,
            boxSizing: "border-box",
            display: "none"
        });
        return el;
    }

    function onMove(e) {
        if (!enabled) return;
        const target = pickTarget(e.target);
        if (!target) return hideAll();

        if (target === lastTarget) return;
        lastTarget = target;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => draw(target));
    }

    function onRepaint() {
        if (enabled && lastTarget) {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => draw(lastTarget));
        }
    }

    function pickTarget(node) {
        if (!node || node.nodeType !== 1) return null;
        if (root && root.contains(node)) return null;
        return node;
    }

    function draw(el) {
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);

        const mt = parseFloat(cs.marginTop),
            mr = parseFloat(cs.marginRight),
            mb = parseFloat(cs.marginBottom),
            ml = parseFloat(cs.marginLeft);

        const bt = parseFloat(cs.borderTopWidth),
            br = parseFloat(cs.borderRightWidth),
            bb = parseFloat(cs.borderBottomWidth),
            bl = parseFloat(cs.borderLeftWidth);

        const pt = parseFloat(cs.paddingTop),
            pr = parseFloat(cs.paddingRight),
            pb = parseFloat(cs.paddingBottom),
            pl = parseFloat(cs.paddingLeft);


        setBox(marginBox, rect.left - ml, rect.top - mt, rect.width + ml + mr, rect.height + mt + mb);
        const padLeft = rect.left + bl;
        const padTop = rect.top + bt;
        const padWidth = rect.width - bl - br;
        const padHeight = rect.height - bt - bb;

        setBox(paddingBox, padLeft, padTop, padWidth, padHeight);

        const contentLeft = padLeft + pl;
        const contentTop = padTop + pt;
        const contentWidth = padWidth - pl - pr;
        const contentHeight = padHeight - pt - pb;
        setBox(contentBox, contentLeft, contentTop, contentWidth, contentHeight);

        tooltip.innerHTML = formatTooltip(el, cs, rect);
        tooltip.style.display = "block";

        tooltip.style.left = `${Math.min(rect.left, window.innerWidth - tooltip.offsetWidth - 8)}px`;
        tooltip.style.top = `${Math.max(8, rect.top - tooltip.offsetHeight - 8)}px`;
    }

    function onClick(e) {
        if (!enabled) return;
        const el = pickTarget(e.target);
        if (!el) return;

        e.preventDefault();
        e.stopPropagation();

        const cs = getComputedStyle(el);
        const props = [
            "display",
            "position",
            "color",
            "background-color",
            "font-family",
            "font-size",
            "font-weight",
            "margin",
            "padding",
            "border",
            "border-radius"
        ];

        const cssText = props
            .map(p => {
                const v = cs.getPropertyValue(p);
                return v && v !== "0px" && v !== "none" ? `${p}: ${v};` : null;
            })
            .filter(Boolean)
            .join("\n");

        navigator.clipboard.writeText(cssText)
            .then(() => showCopiedToast("CSS copied to clipboard!"))
            .catch(() => showCopiedToast("Error copying the css rules"));
    }

    function showCopiedToast(msg) {
        const toast = document.createElement("div");
        toast.textContent = msg;
        Object.assign(toast.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            background: "#28a745",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "14px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            zIndex: "2147483647",
            opacity: "0",
            transition: "opacity 0.3s ease"
        });
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.style.opacity = "1");
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.addEventListener("transitionend", () => toast.remove());
        }, 1500);
    }

    function setBox(el, left, top, width, height) {
        Object.assign(el.style, {
            display: "block",
            left: `${Math.round(left)}px`,
            top: `${Math.round(top)}px`,
            width: `${Math.round(width)}px`,
            height: `${Math.round(height)}px`
        });
    }

    function hideAll() {
        [marginBox, paddingBox, contentBox].forEach(el => el.style.display = "none");
        tooltip.style.display = "none";
    }

    function formatTooltip(el, cs, rect) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string"
            ? "." + el.className.trim().split(/\s+/).join(".")
            : "";

        const colors = { bg: '#f8fafc', border: '#cbd5e1', title: '#13458f', label: '#1e293b', value: '#334155' };

        const header = `<div style="
            font-weight: 700;
            color: ${colors.title};
            font-size: 13px;
            border-bottom: 1px solid ${colors.border};
            padding-bottom: 4px;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        ">
            <div> <bdi style="color: #8a20ac">${tag}</bdi>${id || cls}</div>
            <span style="color:#9ca3af">${Math.round(rect.width)}×${Math.round(rect.height)}</span>
        </div>`;

        const props = [
            "display",
            "position",
            "color",
            "background-color",
            "font-family",
            "font-size",
            "font-weight",
            "margin",
            "padding",
            "border",
            "border-radius"
        ];

        const lines = props
            .map(p => {
                const v = cs.getPropertyValue(p);
                return v && v !== "0px" && v !== "none"
                    ? `<div style="line-height:1.2; margin:1px 0;">
                        <b style="color:${colors.label}">${p}</b>: 
                        <span style="color:${colors.value}">${v}</span>
                    </div>`
                    : null;
            })
            .filter(Boolean)
            .join("");

        return `<div style="
            display: inline-block;
            background: ${colors.bg};
            border: 1px solid ${colors.border};
            border-radius: 8px;
            padding: 6px 8px;
            max-width: 280px;
            box-shadow: rgba(0, 0, 0, 0.25) 0px 14px 28px, rgba(0, 0, 0, 0.22) 0px 10px 10px;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
            font-size: 12px;
            line-height: 1.2;
            pointer-events: none;
            white-space: normal;
        ">
            ${header}
            <div style="text-align: left;">${lines}</div>
            <div style="padding: 12px; font-size: 11px; color: #0069d9; display:flex; justify-content: center;">Click on element to copy css!</div>
        </div>`;
    }
})();
