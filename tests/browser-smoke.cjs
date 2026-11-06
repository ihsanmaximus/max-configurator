const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));

  try {
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8080", { waitUntil: "domcontentloaded" });
    await page.locator("#maximusPassword").waitFor({ state: "visible", timeout: 15000 });
    await page.locator("#maximusPassword").fill(process.env.MAXIMUS_TEST_PASSWORD || "maximus-browser-smoke");
    await page.locator("#maximusLoginButton").click();
    await page.locator("#manageProjects").waitFor({ state: "visible", timeout: 15000 });
    await page.waitForFunction(() => !document.body.classList.contains("auth-locked"));

    // Create a fresh project through the actual Project Manager UI.
    await page.locator("#manageProjects").click();
    await page.locator("#pmNewName").fill("Browser E2E Project");
    await page.locator("#pmCreate").click();
    await page.waitForFunction(() => document.querySelector("#projectName")?.textContent === "Browser E2E Project", null, { timeout: 15000 });

    // Edit, save through PHP, reload, and verify persistence in the editor.
    const heroTitle = page.locator('[data-path="sections.hero.title"]');
    await heroTitle.fill("Browser E2E Saved Title");
    await page.locator("#saveButton").click();
    await page.waitForFunction(() => document.querySelector("#saveState")?.textContent.includes("Tersimpan di server"), null, { timeout: 15000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !document.body.classList.contains("auth-locked"), null, { timeout: 15000 });
    await page.locator('[data-path="sections.hero.title"]').waitFor({ state: "visible", timeout: 15000 });
    const persisted = await page.locator('[data-path="sections.hero.title"]').inputValue();
    if (persisted !== "Browser E2E Saved Title") throw new Error("Saved editor value did not persist after reload: " + persisted);

    // Basic responsive overflow check at common phone widths.
    for (const width of [1440, 1024, 900, 768, 390, 360]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (overflow) throw new Error("Horizontal page overflow at viewport width " + width);
    }

    if (errors.length) throw new Error("Browser JavaScript errors: " + errors.join(" | "));
    console.log("PASS: browser login, project creation, editor save/reload persistence, responsive widths 1440/1024/900/768/390/360, no page errors.");
  } finally {
    await browser.close();
  }
})();
