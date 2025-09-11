import React, { useState, useMemo, useEffect } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import {
  Globe,
  RefreshCw,
  Images,
  Save as SaveIcon,
  FileText as FileTextIcon,
  Link as LinkIcon,
} from "lucide-react";

function Field({ label, value }) {
  return (
    <div className="field">
      <div className="label">{label}</div>
      <div style={{ wordBreak: "break-word" }}>{value ?? "—"}</div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("https://batdongsan.com.vn/");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(-1);

  const domainOk = useMemo(
    () => /https?:\/\/([^/]*\.)?batdongsan\.com\.vn\//i.test(url),
    [url]
  );

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
    try {
      const res = await fetch("/api/scrape?url=" + encodeURIComponent(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      console.log(json);
      setData(json);
    } catch (e) {
      setErr(e?.message || "Scrape thất bại");
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
      Id: "",
      ["Tôi là * "]: "",
      ["Loại tin đăng * "]: "",
      ["Loại tài sản * "]: "",
      ["Tên tin đăng *"]: data?.title || "",
      ["Mô tả *"]: data?.descriptionHTML || "",
      ["Số điện thoại *"]: "",
      ["Địa chỉ chi tiết *"]: data?.address || "",
      ["Tỉnh/Thành Phố *"]: "",
      ["Quận  *"]: "",
      ["Phường/Xã *"]: "",
      ["Phòng ngủ"]: data?.bedrooms || "",
      ["Phòng vệ sinh"]: data?.bathrooms || "",
      ["Diện tích  *"]: data?.area || "",
      ["Trạng thái pháp lý"]: data?.legal || "",
      ["Trạng thái bàn giao"]: "",
      ["Tình trạng nội thất"]: data?.furniture || "",
      ["Hướng nhà"]: data?.balconyDirection || "",
      ["Video link (Link youtube)"]: "",
      ["Dự án  *"]: "",
      ["Block/Tháp"]: "",
      ["Tầng"]: "",
      ["Căn hộ  *"]: "",
      ["Giá (VNĐ)  *"]: data?.price || "",
      ["Dự kiến ngày đăng  *"]: data?.postedAt || "",
      ["Ngày Đẩy Tin Đăng"]: data?.postedAt || "",
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
      Id: "",
      ["Tôi là * "]: "",
      ["Loại tin đăng * "]: "",
      ["Loại tài sản * "]: "",
      ["Tên tin đăng *"]: data?.title || "",
      ["Mô tả *"]: data?.descriptionHTML || "",
      ["Số điện thoại *"]: "",
      ["Địa chỉ chi tiết *"]: data?.address || "",
      ["Tỉnh/Thành Phố *"]: "",
      ["Quận  *"]: "",
      ["Phường/Xã *"]: "",
      ["Phòng ngủ"]: data?.bedrooms || "",
      ["Phòng vệ sinh"]: data?.bathrooms || "",
      ["Diện tích  *"]: data?.area || "",
      ["Trạng thái pháp lý"]: data?.legal || "",
      ["Trạng thái bàn giao"]: "",
      ["Tình trạng nội thất"]: data?.furniture || "",
      ["Hướng nhà"]: data?.balconyDirection || "",
      ["Video link (Link youtube)"]: "",
      ["Dự án  *"]: "",
      ["Block/Tháp"]: "",
      ["Tầng"]: "",
      ["Căn hộ  *"]: "",
      ["Giá (VNĐ)  *"]: data?.price || "",
      ["Dự kiến ngày đăng  *"]: data?.postedAt || "",
      ["Ngày Đẩy Tin Đăng"]: data?.postedAt || "",
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
    <div className="container">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="h1">
          <Globe size={24} /> Trích xuất thông tin Batdongsan.com.vn
        </h1>
        <div className="card">
          <div className="card-h">
            <LinkIcon size={18} /> Nhập đường dẫn tin
          </div>
          <div className="card-c">
            <div className="row">
              <input
                className="input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://batdongsan.com.vn/..."
              />
              <button
                className="btn"
                onClick={handleScrape}
                disabled={!domainOk || loading}
              >
                <RefreshCw size={16} />{" "}
                {loading ? "Đang trích xuất..." : "Trích xuất"}
              </button>
            </div>
            {err && (
              <div className="muted" style={{ marginTop: 8, color: "#b91c1c" }}>
                Lỗi: {String(err)}
              </div>
            )}
          </div>
        </div>

        {data && (
          <div style={{ marginTop: 16 }}>
            <div className="card">
              <div className="card-h">
                <FileTextIcon size={18} /> Thông tin bài đăng
              </div>
              <div className="card-c">
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
                      <div className="sep"></div>
                      {data.attributes.map((a, i) => (
                        <Field key={i} label={a.label} value={a.value} />
                      ))}
                    </>
                  )}

                {data.descriptionHTML && (
                  <>
                    <div className="sep"></div>
                    <div className="muted" style={{ marginBottom: 6 }}>
                      Mô tả (HTML)
                    </div>
                    <div
                      className="prose"
                      dangerouslySetInnerHTML={{ __html: data.descriptionHTML }}
                    />
                  </>
                )}

                <div className="sep"></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-secondary" onClick={downloadJSON}>
                    <SaveIcon size={16} /> Tải JSON
                  </button>
                  <button className="btn" onClick={exportExcelSale}>
                    <FileTextIcon size={16} /> Tải Excel Bán(.xlsx)
                  </button>
                  <button className="btn" onClick={exportExcelRent}>
                    <FileTextIcon size={16} /> Tải Excel Thuê(.xlsx)
                  </button>
                  <button
                    className="btn"
                    onClick={downloadImagesZip}
                    disabled={!data.images?.length}
                  >
                    <Images size={16} /> Tải ảnh (.zip)
                  </button>
                </div>
              </div>
            </div>

            {Array.isArray(data.images) && data.images.length > 0 && (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-h">
                  <Images size={18} /> Hình ảnh ({data.images.length})
                </div>
                <div className="card-c">
                  <div className="gallery">
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
                          className="img"
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
      </motion.div>
    </div>
  );
}
