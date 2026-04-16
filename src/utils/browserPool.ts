import puppeteer, { Browser, Page } from "puppeteer";

const LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-translate",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
];

const MAX_CONCURRENT_PAGES = 3;
const MAX_USES_BEFORE_RESTART = 100;
const MAX_RETRIES = 2;

let browser: Browser | null = null;
let useCount = 0;
let activePages = 0;
let launchPromise: Promise<Browser> | null = null;
const waitQueue: (() => void)[] = [];

const getBrowser = async (): Promise<Browser> => {
    if (browser && browser.connected && useCount < MAX_USES_BEFORE_RESTART) {
        return browser;
    }

    if (launchPromise) {
        return launchPromise;
    }


    launchPromise = (async () => {
        try {
            if (browser) {
                try {
                    await browser.close();
                } catch { /* ignore */ }
                browser = null;
            }

            browser = await puppeteer.launch({
                headless: true,
                args: LAUNCH_ARGS,
            });

            useCount = 0;
            console.log("[BrowserPool] Chromium launched");

            browser.on("disconnected", () => {
                console.warn("[BrowserPool] Chromium disconnected, will relaunch on next request");
                browser = null;
                useCount = 0;
            });

            return browser;
        } finally {
            launchPromise = null;
        }
    })();

    return launchPromise;
};

// ─── Semaphore: ننتظر لحد ما يكون فيه slot فاضي ────────────────────────────
const acquireSlot = async (): Promise<void> => {
    if (activePages < MAX_CONCURRENT_PAGES) {
        activePages++;
        return;
    }
    // ننتظر في الـ queue
    await new Promise<void>((resolve) => waitQueue.push(resolve));
    activePages++;
};

const releaseSlot = () => {
    activePages--;
    if (waitQueue.length > 0) {
        const next = waitQueue.shift();
        next?.();
    }
};

// ─── الـ API الرئيسي: استخدم page ونفّذ callback مع retry ──────────────────
export const usePage = async <T>(fn: (page: Page) => Promise<T>): Promise<T> => {
    await acquireSlot();

    let lastError: any = null;

    try {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            let page: Page | null = null;
            try {
                const b = await getBrowser();

                // تأكد إن الـ browser لسه شغّال
                if (!b.connected) {
                    browser = null;
                    useCount = 0;
                    continue; // retry مع browser جديد
                }

                page = await b.newPage();
                useCount++;

                const result = await fn(page);
                return result;
            } catch (err: any) {
                lastError = err;
                console.warn(`[BrowserPool] Attempt ${attempt + 1} failed: ${err.message}`);

                // لو الـ error بسبب browser مقفول — نعمل reset ونحاول تاني
                if (
                    err.message?.includes("Target closed") ||
                    err.message?.includes("Session closed") ||
                    err.message?.includes("Protocol error") ||
                    err.message?.includes("Navigation failed") ||
                    err.message?.includes("browser has disconnected")
                ) {
                    browser = null;
                    useCount = 0;
                } else {
                    // error تاني مش متعلق بالـ browser — نرميه فوراً
                    break;
                }
            } finally {
                if (page) {
                    try {
                        await page.close();
                    } catch { /* ignore */ }
                }
            }
        }
    } finally {
        releaseSlot();
    }

    throw lastError;
};

// ─── إغلاق الـ browser عند إيقاف السيرفر (graceful shutdown) ────────────────
export const closeBrowserPool = async () => {
    if (browser) {
        try {
            await browser.close();
        } catch { /* ignore */ }
        browser = null;
        console.log("[BrowserPool] Chromium closed");
    }
};
