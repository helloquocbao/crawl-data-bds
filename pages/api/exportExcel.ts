// pages/api/exportExcel.ts
import XlsxPopulate from "xlsx-populate";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const summary = req.body || {};

    // Load file gốc từ thư mục public
    const templatePath = path.join(
      process.cwd(),
      "public",
      "Listing_Import_SALE.xlsx"
    );
    const workbook = await XlsxPopulate.fromFileAsync(templatePath);
    const sheet = workbook.sheet(0);

    // Đổ data vào dòng 3
    const headers = Object.keys(summary);
    headers.forEach((key, i) => {
      const col = i + 1;
      sheet.cell(3, col).value(summary[key] ?? "");
    });

    // Xuất buffer
    const buffer = await workbook.outputAsync();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Listing_Import_SALE_filled.xlsx"
    );
    res.end(buffer);
  } catch (err) {
    console.error("Export Excel error:", err);
    res.status(500).json({ error: "Failed to export excel" });
  }
}
