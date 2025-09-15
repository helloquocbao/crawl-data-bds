import { useState, useMemo, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  Images,
  Save as SaveIcon,
  FileText as FileTextIcon,
  Link as LinkIcon,
} from "lucide-react";
import { ArrowRight } from "lucide-react";

function isFromBatDongSan(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "") === "batdongsan.com.vn";
  } catch {
    return false;
  }
}

function normalizeDirection(input) {
  return input.replace(/\s*-\s*/g, " ");
}

function parseAddressByComma(addr) {
  const parts = addr.split(",").map((s) => s.trim());
  const len = parts.length;

  const city = parts[len - 1] || null;
  const district = parts[len - 2] || null;
  const ward = parts[len - 3] || null;

  return { ward, district, city };
}

function Field({ label, value }) {
  return (
    <div className="col-span-12 grid grid-cols-12 border-b border-dotted">
      <div className=" col-span-4 py-1">{label}</div>
      <div className=" col-span-8 py-1" style={{ wordBreak: "break-word" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}
function getNumberFromString(str) {
  const area = str.replace(/[^0-9.,]/g, ""); // bỏ tất cả ký tự không phải số

  return area;
}

function parsePrice(str) {
  if (!str) return null;

  str = str.toLowerCase().trim();
  let multiplier = 1;

  if (str.includes("tỷ")) multiplier = 1_000_000_000;
  else if (str.includes("triệu")) multiplier = 1_000_000;

  const numMatch = str.match(/[\d.,]+/);
  if (!numMatch) return null;

  let numStr = numMatch[0];
  if (numStr.includes(",") && !numStr.includes("."))
    numStr = numStr.replace(",", ".");
  else numStr = numStr.replace(/,/g, "");

  const num = parseFloat(numStr) * multiplier;
  return num;
}

function formatPrice(str) {
  const num = parsePrice(str);
  if (num === null) return null;
  return num.toLocaleString("en-US");
}

function cleanHTML(html) {
  if (!html) return "";

  const div = document.createElement("div");
  div.innerHTML = html;

  // Xóa các span chứa số điện thoại/ẩn
  const spans = div.querySelectorAll(
    "span.hidden-mobile, span.hidden-phone, span.js__btn-tracking"
  );
  spans.forEach((span) => span.remove());

  // Chuyển <br> thành xuống dòng
  div.querySelectorAll("br").forEach((br) => {
    br.replaceWith("\n");
  });

  // Chuyển <p> thành xuống dòng
  div.querySelectorAll("p").forEach((p) => {
    p.replaceWith(p.textContent + "\n");
  });

  // Lấy text thuần
  const text = div.textContent || div.innerText || "";

  // Loại bỏ khoảng trắng thừa nhưng giữ xuống dòng
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

export default function Home() {
  const [url, setUrl] = useState("https://batdongsan.com.vn/");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  // const domainOk = useMemo(
  //   () => /https?:\/\/([^/]*\.)?batdongsan\.com\.vn\//i.test(url),
  //   [url]
  // );

  useEffect(() => {
    function onKey(e) {
      if (lightboxIdx < 0) return;
      if (e.key === "Escape") setLightboxIdx(-1);
      if (e.key === "ArrowRight")
        setLightboxIdx((i) => Math.min(i + 1, (data?.images?.length || 1) - 1));
      if (e.key === "ArrowLeft") setLightboxIdx((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, data]);

  async function handleScrape() {
    setLoading(true);
    setErr(null);
    setData(null);
    console.log("url", url);
    if (!isFromBatDongSan(url, "batadongsan.com.vn")) {
      setErr("Chỉ hỗ trợ batdongsan.com.vn");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/scrape?url=" + encodeURIComponent(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      console.log(json);
      setData(json);
    } catch (e) {
      setErr(e?.message || "Scrape thất bại");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  }

  async function downloadImagesZip() {
    if (!data?.images?.length) return;
    const zip = new JSZip();
    const folder = zip.folder("images_" + (data.codeId || "listing"));
    for (let i = 0; i < data.images.length; i++) {
      const src = data.images[i];
      try {
        const resp = await fetch(
          "/api/proxy-image?src=" + encodeURIComponent(src)
        );
        const ab = await resp.arrayBuffer();
        const ext = (src.split("?")[0].split(".").pop() || "jpg")
          .toLowerCase()
          .substring(0, 5);
        folder.file(String(i + 1).padStart(3, "0") + "." + (ext || "jpg"), ab);
      } catch (e) {
        /* skip */
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, "batdongsan_images_" + (data.codeId || "listing") + ".zip");
  }

  function downloadJSON() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    saveAs(blob, `batdongsan_${data.codeId || "listing"}.json`);
  }

  function exportExcelSale() {
    if (!data) return;

    const summary = {
      ["Tôi là * "]: "Môi giới",
      ["Loại tin đăng * "]: "Bán",
      ["Gói tin đăng"]: "Bạch Kim",
      ["Loại tài sản *"]: "",
      ["Tên tin đăng *"]: data?.title || "",
      ["Mô tả *"]: cleanHTML(data?.descriptionHTML) || "",
      ["Số điện thoại *"]: "",
      ["Địa chỉ chi tiết *"]: data?.address || "",
      ["Tỉnh/Thành Phố *"]:
        parseAddressByComma(data?.address || "")?.city || "",
      ["Quận  *"]: parseAddressByComma(data?.address || "")?.district || "",
      ["Phường/Xã *"]: parseAddressByComma(data?.address || "")?.ward || "",
      ["Phòng ngủ"]: data?.bedrooms ? `${data.bedrooms} ngủ` : "",
      ["Phòng vệ sinh"]: data?.bathrooms ? `${data.bathrooms} vệ sinh` : "",
      ["Diện tích  *"]: data?.area ? getNumberFromString(data.area) : "",
      ["Trạng thái pháp lý"]:
        data?.legal === "Sổ đỏ/ Sổ hồng"
          ? "Đã Cấp Sổ Hồng"
          : "Đang Chờ Sổ Hồng",
      ["Trạng thái bàn giao"]: "",
      ["Tình trạng nội thất"]:
        data?.furniture === "Đầy đủ"
          ? "Nội thất đầy đủ"
          : data?.furniture === "Cơ bản"
          ? "Nội thất cơ bản"
          : "Không có nội thất",
      ["Hướng nhà"]: data?.balconyDirection
        ? normalizeDirection(data.balconyDirection)
        : "",
      ["Video link (Link youtube)"]: "",
      ["Dự án  *"]: data?.project,
      ["Block/Tháp"]: "",
      ["Tầng"]: "",
      ["Căn hộ  *"]: "Đang cập nhật",
      ["Giá (VNĐ)  *"]: data?.price ? formatPrice(data.price) : "",
      ["Dự kiến ngày đăng  *"]: "",
      ["Ngày Đẩy Tin Đăng"]: "",
    };
    const wsSummary = XLSX.utils.json_to_sheet([summary]);
    const attrs = Array.isArray(data.attributes)
      ? data.attributes.map((a) => ({
          Nhan: a.label || "",
          Gia_tri: a.value || "",
        }))
      : [];
    const imgs = (data.images || []).map((u, i) => ({
      STT: i + 1,
      Anh_URL: u,
    }));
    const wsImgs = XLSX.utils.json_to_sheet(
      imgs.length ? imgs : [{ Thong_bao: "Khong co anh" }]
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Tong_quan");
    XLSX.utils.book_append_sheet(wb, wsImgs, "Anh");
    const name = `batdongsan_${data.codeId || "listing"}.xlsx`;
    XLSX.writeFile(wb, name);
  }

  function exportExcelRent() {
    if (!data) return;
    const summary = {
      ["Tôi là * "]: "Môi giới",
      ["Loại tin đăng * "]: "Thuê",
      ["Gói tin đăng"]: "Bạch Kim",
      ["Loại tài sản *"]: "",
      ["Tên tin đăng *"]: data?.title || "",
      ["Mô tả *"]: cleanHTML(data?.descriptionHTML) || "",
      ["Số điện thoại *"]: "",
      ["Địa chỉ chi tiết *"]: data?.address || "",
      ["Tỉnh/Thành Phố *"]:
        parseAddressByComma(data?.address || "")?.city || "",
      ["Quận  *"]: parseAddressByComma(data?.address || "")?.district || "",
      ["Phường/Xã *"]: parseAddressByComma(data?.address || "")?.ward || "",
      ["Phòng ngủ"]: data?.bedrooms ? `${data.bedrooms} ngủ` : "",
      ["Phòng vệ sinh"]: data?.bathrooms ? `${data.bathrooms} vệ sinh` : "",
      ["Diện tích  *"]: data?.area ? getNumberFromString(data.area) : "",
      ["Trạng thái pháp lý"]:
        data?.legal === "Sổ đỏ/ Sổ hồng"
          ? "Đã Cấp Sổ Hồng"
          : "Đang Chờ Sổ Hồng",
      ["Trạng thái bàn giao"]: "",
      ["Tình trạng nội thất"]:
        data?.furniture === "Đầy đủ"
          ? "Nội thất đầy đủ"
          : data?.furniture === "Cơ bản"
          ? "Nội thất cơ bản"
          : "Không có nội thất",
      ["Hướng nhà"]: data?.balconyDirection
        ? normalizeDirection(data?.balconyDirection)
        : "",
      ["Video link (Link youtube)"]: "",
      ["Dự án  *"]: data?.project,
      ["Block/Tháp"]: "",
      ["Tầng"]: "",
      ["Căn hộ  *"]: "Đang cập nhật",
      ["Giá (VNĐ)  *"]: data?.price ? formatPrice(data.price) : "",
      ["Dự kiến ngày đăng  *"]: "",
      ["Ngày Đẩy Tin Đăng"]: "",
      ["Thời Hạn Thuê"]: "",
      ["Có thể dọn vào"]: "",
      ["Phí Quản Lý (VND)/Tháng *"]: "",
    };
    const wsSummary = XLSX.utils.json_to_sheet([summary]);
    const attrs = Array.isArray(data.attributes)
      ? data.attributes.map((a) => ({
          Nhan: a.label || "",
          Gia_tri: a.value || "",
        }))
      : [];
    const imgs = (data.images || []).map((u, i) => ({
      STT: i + 1,
      Anh_URL: u,
    }));
    const wsImgs = XLSX.utils.json_to_sheet(
      imgs.length ? imgs : [{ Thong_bao: "Khong co anh" }]
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Tong_quan");
    XLSX.utils.book_append_sheet(wb, wsImgs, "Anh");
    const name = `batdongsan_${data.codeId || "listing"}.xlsx`;
    XLSX.writeFile(wb, name);
  }

  return (
    <>
      <nav
        className={`fixed w-full z-50 transition-all duration-300 ${"bg-[#1e293b] backdrop-blur-md py-3 shadow-lg"}`}
      >
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-white">
              DOMDOM <span className="text-crypto-purple">CrawlData</span>
            </h1>
          </div>

          {/* Desktop menu */}
          <ul className="hidden lg:flex items-center space-x-8">
            <li></li>
            <li>
              <a
                href="#how-it-works"
                className="text-gray-300 hover:text-white transition-colors"
              >
                {/* How it works */}
              </a>
            </li>
            <li>
              <a
                href="#testimonials"
                className="text-gray-300 hover:text-white transition-colors"
              >
                {/* Testimonials */}
              </a>
            </li>
            <li>
              <a
                href="#pricing"
                className="text-gray-300 hover:text-white transition-colors"
              >
                {/* Pricing */}
              </a>
            </li>
            <li>
              <a
                href="#faq"
                className="text-gray-300 hover:text-white transition-colors"
              >
                {/* FAQ */}
              </a>
            </li>
          </ul>
        </div>
      </nav>
      <div className="min-h-screen overflow-x-hidden">
        <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-gradient-hero hero-glow">
          {/* Animated Background Elements */}
          <div className="container mx-auto px-4 mt-24 relative z-10">
            <div className="grid grid-cols-7 space-x-4 items-center ">
              <div className="col-span-4 animate-fade-in-left">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  <span className="text-gradient">
                    Trích xuất thông tin Batdongsan.com.vn
                  </span>
                </h1>
                <input
                  type="text"
                  class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5  dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://batdongsan.com.vn/..."
                />

                <div className="flex justify-between gap-4 mt-2">
                  {err ? <span>{err}</span> : <span></span>}
                  <button
                    onClick={handleScrape}
                    disabled={loading}
                    className="text-white flex bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin h-5 w-5 mr-2 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                          />
                        </svg>
                        Đang trích xuất...
                      </>
                    ) : (
                      <>
                        Trích xuất
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="col-span-3 flex justify-end pr-16 mt-12 lg:mt-0 animate-fade-in-right">
                <div className="relative max-w-md animate-float">
                  <img
                    src="https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&h=800"
                    alt="Trading platform dashboard"
                    className="rounded-xl shadow-2xl border border-white/10"
                  />
                </div>
              </div>
            </div>
          </div>

          {data && (
            <div
              style={{ marginTop: 16 }}
              className=" rounded-lg mx-[15%] text-black bg-white p-10"
            >
              <div>
                <div className="text-xl font-semibold mb-4 flex items-center">
                  <FileTextIcon size={18} className="mr-1" /> Thông tin bài đăng
                </div>
                <div className="grid grid-cols-12 space-y-2 gap-x-4 ">
                  <Field label="Tiêu đề" value={data.title} />
                  <Field label="Mã tin" value={data.codeId} />
                  <Field label="Mức giá" value={data.price} />
                  <Field label="Đơn giá/m²" value={data.pricePerM2} />
                  <Field label="Diện tích" value={data.area} />
                  <Field label="Phòng ngủ" value={data.bedrooms} />
                  <Field label="Phòng tắm/VS" value={data.bathrooms} />
                  <Field label="Số tầng" value={data.floors} />
                  <Field label="Hướng nhà" value={data.direction} />
                  <Field label="Hướng ban công" value={data.balconyDirection} />
                  <Field label="Pháp lý" value={data.legal} />
                  <Field label="Nội thất" value={data.furniture} />
                  <Field label="Địa chỉ" value={data.address} />
                  <Field label="Ngày đăng" value={data.postedAt} />
                  <Field label="Hết hạn" value={data.expiredAt} />

                  {Array.isArray(data.attributes) &&
                    data.attributes.length > 0 && (
                      <>
                        {data.attributes.map((a, i) => (
                          <Field key={i} label={a.label} value={a.value} />
                        ))}
                      </>
                    )}

                  {data.descriptionHTML && (
                    <>
                      <div className="col-span-4" style={{ marginBottom: 6 }}>
                        Mô tả
                      </div>
                      <div
                        className="col-span-8 w-full"
                        dangerouslySetInnerHTML={{
                          __html: data.descriptionHTML,
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="flex mt-3 border-t border-dotted py-3">
                <button
                  class="flex text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  onClick={downloadJSON}
                >
                  <SaveIcon size={16} /> Tải JSON
                </button>

                <button
                  class="flex text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  onClick={exportExcelSale}
                >
                  <FileTextIcon size={16} /> Tải Excel Bán(.xlsx)
                </button>
                <button
                  class="flex text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  onClick={exportExcelRent}
                >
                  <FileTextIcon size={16} /> Tải Excel Thuê(.xlsx)
                </button>
                <button
                  class="flex text-white bg-gradient-to-br from-purple-600 to-blue-500 hover:bg-gradient-to-bl focus:ring-4 focus:outline-none focus:ring-blue-300 dark:focus:ring-blue-800 font-medium rounded-lg text-sm px-5 py-2.5 text-center me-2 mb-2"
                  onClick={downloadImagesZip}
                  disabled={!data.images?.length}
                >
                  <Images size={16} /> Tải ảnh (.zip)
                </button>
              </div>
              {Array.isArray(data.images) && data.images.length > 0 && (
                <div
                  className="bg-white border border-[#e2e8f0]"
                  style={{ marginTop: 16 }}
                >
                  <div className="flex items-center pt-2 pl-2">
                    <Images size={18} className="mr-1" /> Hình ảnh (
                    {data.images.length})
                  </div>
                  <div className="flex gap-2 p-[16px]">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {data.images.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.preventDefault();
                            setLightboxIdx(i);
                          }}
                        >
                          <img
                            className="rounded-xl h-[200px] w-[280px] object-cover"
                            src={
                              "/api/proxy-image?src=" + encodeURIComponent(src)
                            }
                            onError={(e) => {
                              e.currentTarget.parentElement.style.display =
                                "none";
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {lightboxIdx >= 0 && data?.images?.[lightboxIdx] && (
                <div
                  onClick={() => setLightboxIdx(-1)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 20,
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={() => setLightboxIdx(-1)}
                  >
                    ✕
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIdx((i) => Math.max(0, i - 1));
                    }}
                    style={{
                      position: "absolute",
                      left: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 24,
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    ‹
                  </button>
                  <img
                    src={
                      "/api/proxy-image?src=" +
                      encodeURIComponent(data.images[lightboxIdx])
                    }
                    style={{
                      maxWidth: "90vw",
                      maxHeight: "85vh",
                      objectFit: "contain",
                      borderRadius: 12,
                      boxShadow: "0 8px 30px rgba(0,0,0,.5)",
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIdx((i) =>
                        Math.min(data.images.length - 1, i + 1)
                      );
                    }}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      fontSize: 24,
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    ›
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 16,
                      left: 0,
                      right: 0,
                      color: "#fff",
                      textAlign: "center",
                      fontSize: 12,
                      opacity: 0.9,
                    }}
                  >
                    {lightboxIdx + 1} / {data.images.length}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
