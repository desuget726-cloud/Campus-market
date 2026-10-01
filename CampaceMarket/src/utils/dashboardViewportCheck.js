const VIEWPORT_WIDTHS = [320, 360, 375, 414, 600, 767, 1024];
const DASHBOARD_VIEWS = ['home', 'buyer', 'seller', 'messages', 'notifications', 'settings'];
const BUYER_TABS = ['search', 'wishlist', 'cart', 'orders', 'payments'];
const SETTINGS_TABS = ['account', 'payout', 'security', 'notifications'];

const waitForLayout = (page) => page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

const inspectOverflow = (page) => page.evaluate(() => {
    const width = window.innerWidth;
    const elements = Array.from(document.querySelectorAll('body *'))
        .map((element) => {
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            return {
                tag: element.tagName.toLowerCase(),
                id: element.id,
                className: typeof element.className === 'string' ? element.className : '',
                text: element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) || '',
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                cssWidth: style.width,
                minWidth: style.minWidth,
                display: style.display,
                position: style.position,
                overflowX: style.overflowX,
            };
        })
        .filter((element) => element.width > 0 && element.right > width + 1);

    return {
        viewportWidth: width,
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        elements: elements.slice(0, 20),
    };
});

export async function checkDashboardViewport(page, {
    widths = VIEWPORT_WIDTHS,
    languages = ['en', 'am'],
    colorSchemes = ['light', 'dark'],
} = {}) {
    const originalViewport = page.viewportSize();
    const originalLanguage = await page.evaluate(() => localStorage.getItem('campaceLanguage'));
    const originalColorScheme = await page.evaluate(() => (
        window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    ));
    const failures = [];

    try {
        for (const language of languages) {
            await page.evaluate((value) => localStorage.setItem('campaceLanguage', value), language);
            await page.reload();
            await page.locator('[data-dashboard-target="home"]').waitFor();

            for (const colorScheme of colorSchemes) {
                await page.emulateMedia({ colorScheme });
                for (const view of DASHBOARD_VIEWS) {
                    await page.setViewportSize({ width: 1024, height: 900 });
                    await page.locator(`[data-dashboard-target="${view}"]`).click();
                    await page.locator(`[data-dashboard-view="${view}"]`).waitFor();

                    const tabs = view === 'buyer'
                        ? BUYER_TABS.map((tab) => `[data-buyer-tab="${tab}"]`)
                        : view === 'settings'
                            ? SETTINGS_TABS.map((tab) => `[data-settings-tab="${tab}"]`)
                            : [];
                    const states = tabs.length ? tabs : [null];

                    for (const tabSelector of states) {
                        if (tabSelector) await page.locator(tabSelector).click();
                        for (const width of widths) {
                            await page.setViewportSize({ width, height: 900 });
                            await waitForLayout(page);
                            const result = await inspectOverflow(page);
                            if (result.documentScrollWidth > result.viewportWidth) {
                                failures.push({ language, colorScheme, view, tabSelector, ...result });
                            }
                        }
                    }
                }
            }
        }
    } finally {
        if (originalLanguage === null) {
            await page.evaluate(() => localStorage.removeItem('campaceLanguage'));
        } else {
            await page.evaluate((value) => localStorage.setItem('campaceLanguage', value), originalLanguage);
        }
        await page.emulateMedia({ colorScheme: originalColorScheme });
        if (originalViewport) await page.setViewportSize(originalViewport);
        await page.reload();
    }

    if (failures.length) {
        throw new Error(`Dashboard horizontal overflow detected:\n${JSON.stringify(failures, null, 2)}`);
    }

    return { checkedWidths: widths, checkedLanguages: languages, checkedColorSchemes: colorSchemes };
}