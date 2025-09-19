// /pages/api/scrape.js
import puppeteer from "puppeteer";

const DOMAIN_RE = /^https?:\/\/(.*\.)?batdongsan\.com\.vn(\/|$)/i;

// helpers
function normalizeImageUrl(src) {
  try {
    const u = new URL(src);
    u.search = "";
    let s = u.toString();
    s = s.replace(/\/crop\/\d+x\d+\//, "/resize/1200x900/");
    s = s.replace(/([^:]\/)\/+/, "$1/");
    return s;
  } catch (_) {
    return (src || "").split("?")[0];
  }
}
function canonicalKey(src) {
  try {
    const u = new URL(normalizeImageUrl(src));
    const parts = u.pathname.split("/").filter(Boolean);
    const filtered = [];
    for (let i = 0; i < parts.length; i++) {
      if (
        (parts[i] === "crop" || parts[i] === "resize") &&
        i + 1 < parts.length &&
        /^\d+x\d+$/i.test(parts[i + 1])
      ) {
        i++;
        continue;
      }
      filtered.push(parts[i]);
    }
    u.pathname = "/" + filtered.join("/");
    u.search = "";
    return u.toString();
  } catch (_) {
    return normalizeImageUrl(src);
  }
}
async function validateImages(urls, limit = 6) {
  const out = [];
  const list = Array.from(new Set(urls));
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const u = list[i++];
      try {
        const r = await fetch(u, {
          method: "HEAD",
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        const ok =
          r.ok &&
          (r.headers.get("content-type") || "")
            .toLowerCase()
            .startsWith("image") &&
          Number(r.headers.get("content-length") || "0") >= 128;
        if (ok) {
          out.push(u);
          continue;
        }
        const g = await fetch(u, {
          method: "GET",
          redirect: "follow",
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        if (
          g.ok &&
          (g.headers.get("content-type") || "")
            .toLowerCase()
            .startsWith("image")
        )
          out.push(u);
      } catch (_) {}
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, worker)
  );
  return out;
}

export default async function handler(req, res) {
  try {
    const url = String(req.query.url || "");
    if (!DOMAIN_RE.test(url))
      return res.status(400).json({ error: "Chỉ hỗ trợ batdongsan.com.vn" });

    // const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      executablePath:
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // hoặc Chromium path
    });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on("request", (req) =>
      ["image", "font", "media", "stylesheet"].includes(req.resourceType())
        ? req.abort()
        : req.continue()
    );
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

    await Promise.race([
      page.waitForSelector(".re__pr-specs-content-item", { timeout: 20000 }),
      page.waitForSelector("h1", { timeout: 20000 }),
      page.waitForSelector(".js__pr-description", { timeout: 20000 }),
    ]).catch(() => {});

    // expand description if needed
    try {
      await page.evaluate(() => {
        const root =
          document.querySelector(".js__pr-description") ||
          document.querySelector(".re__pr-description");
        if (!root) return;
        const candidates = Array.from(
          root.querySelectorAll("button, a, span")
        ).filter((el) => {
          const t = (el.textContent || "").toLowerCase();
          return (
            t.includes("xem thêm") ||
            t.includes("đọc tiếp") ||
            el.getAttribute("data-view-more") !== null ||
            el.className.includes("readmore") ||
            el.className.includes("viewmore")
          );
        });
        for (const el of candidates) {
          try {
            el.click();
          } catch (_) {}
        }
      });
      await page.waitForTimeout(400);
    } catch {}

    const raw = await page.evaluate(() => {
      const text = (s = "") => String(s).replace(/\s+/g, " ").trim();
      const q = (sel, root = document) => root.querySelector(sel);
      const qa = (sel, root = document) =>
        Array.from(root.querySelectorAll(sel));

      const title = text(q("h1")?.textContent || "");

      const attrs = qa(".re__pr-specs-content-item")
        .map((el) => ({
          label: text(
            q(".re__pr-specs-content-item-title", el)?.textContent || ""
          ),
          value: text(
            q(".re__pr-specs-content-item-value", el)?.textContent || ""
          ),
        }))
        .filter((a) => a.label && a.value);

      let descriptionHTML =
        q(".js__pr-description")?.innerHTML ||
        q(
          ".re__section.re__pr-description.js__section.js__li-description .re__section-body"
        )?.innerHTML ||
        q(".re__pr-description .re__section-body")?.innerHTML ||
        "";

      const address = text(
        q("span.re__pr-short-description.js__pr-address")?.textContent ||
          q(".re__pr-short-description")?.textContent ||
          ""
      );
      const productType =
        document
          .querySelector('.re__breadcrumb a[level="4"]')
          ?.getAttribute("title") || "";

      const cfg = qa("div.re__pr-short-info-item.js__pr-config-item")
        .map((el) => ({
          title: text(q("span.title", el)?.textContent || ""),
          value: text(q("span.value", el)?.textContent || ""),
        }))
        .filter((x) => x.title && x.value);

      const bodyText = document.body.innerText || "";
      const perM2 =
        (bodyText.match(/([\d\.,]+)\s*(triệu|tỷ)\s*\/\s*m²/i) || [])[0] || "";

      const imgs = qa(".re__overlay.js__overlay img")
        .map(
          (img) =>
            img.getAttribute("src") ||
            img.getAttribute("data-src") ||
            img.getAttribute("data-original") ||
            ""
        )
        .filter(Boolean);
      const project = text(q("div.re__project-title")?.textContent || "");

      return {
        title,
        attrs,
        descriptionHTML,
        address,
        cfg,
        perM2,
        imgs,
        project,
        productType,
      };
    });

    await browser.close();

    const mapBy = (lbl) =>
      raw.attrs.find((a) => a.label.toLowerCase().includes(lbl))?.value;
    const price = mapBy("mức giá") || mapBy("giá");
    const pricePerM2 = raw.perM2 || undefined;
    const area = mapBy("diện tích");
    const bedrooms = mapBy("phòng ngủ");
    const bathrooms = mapBy("phòng tắm") || mapBy("vệ sinh");
    const floors = mapBy("số tầng") || mapBy("tầng");
    const direction = mapBy("hướng nhà") || mapBy("hướng");
    const balconyDirection = mapBy("hướng ban công");
    const houseDirection = mapBy("hướng nhà");
    const legal = mapBy("pháp lý");
    const furniture = mapBy("nội thất");

    const used = new Set([
      "mức giá",
      "giá",
      "diện tích",
      "phòng ngủ",
      "phòng tắm",
      "vệ sinh",
      "số tầng",
      "tầng",
      "hướng",
      "hướng nhà",
      "hướng ban công",
      "pháp lý",
      "nội thất",
    ]);
    const attributes = raw.attrs.filter(
      (a) => ![...used].some((k) => a.label.toLowerCase().includes(k))
    );

    const findCfg = (t) =>
      (raw.cfg || []).find((x) => x.title.toLowerCase().includes(t))?.value;
    const postedAt = findCfg("ngày đăng") || undefined;
    const expiredAt =
      findCfg("hết hạn") || findCfg("ngày hết hạn") || undefined;
    const codeId = findCfg("mã tin") || undefined;

    const mapImgs = new Map();
    for (const u of raw.imgs) {
      const key = canonicalKey(u);
      if (!mapImgs.has(key)) mapImgs.set(key, normalizeImageUrl(u));
    }
    const images = await validateImages([...mapImgs.values()], 6);

    const data = {
      sourceUrl: url,
      title: raw.title || undefined,
      codeId: codeId || undefined,
      price,
      pricePerM2,
      area,
      bedrooms,
      bathrooms,
      floors,
      direction,
      balconyDirection,
      houseDirection,
      legal,
      furniture,
      address: raw.address || undefined,
      postedAt,
      expiredAt,
      descriptionHTML: raw.descriptionHTML || undefined,
      attributes,
      images,
      project: raw.project || undefined,
      productType: raw.productType || undefined,
    };
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Scrape error" });
  }
}
