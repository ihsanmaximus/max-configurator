/* Maximus Configurator — Paket 2
 * Single source of truth: project configuration object.
 * Prototype persistence: localStorage. Production adapter will be PHP + JSON.
 */
const STORAGE_KEY = "maximus-paket2-config";
const DEFAULT_CONFIG = {
  schemaVersion: 1,
  project: { id: "demo-dr-nabila", name: "Dr. Nabila — Sp.OG", package: "paket-2", updatedAt: null },
  brand: "Dr. Nabila, Sp.OG",
  logoText: "Dr. Nabila, Sp.OG",
  logoDataUrl: "",
  media: { logo: null, hero: null, about: null, expertise: null },
  brandDescription: "Spesialis Kebidanan dan Kandungan",
  contact: {
    whatsapp: "+62 812 3456 7890", phone: "+62 21 1234 5678",
    email: "halo@drnabila.id", address: "Palembang, Sumatera Selatan",
    instagram: "https://instagram.com/", facebook: "", youtube: "", maps: ""
  },
  sections: {
    hero: { title: "Dr. Nabila, Sp.OG", subtitle: "Spesialis Kebidanan dan Kandungan Pendamping Perempuan di Setiap Tahap Kehidupan", description: "Layanan medis yang profesional, ramah, dan berfokus pada kesehatan reproduksi wanita.", button: "Buat Janji Konsultasi" },
    about: { title: "Mendampingi setiap fase kehidupan perempuan", description: "Saya percaya setiap perempuan berhak mendapatkan informasi dan pendampingan kesehatan yang baik, hangat, dan terpercaya.", button: "Kenali Lebih Dekat" },
    expertise: { title: "Layanan dan Keahlian", description: "Pendampingan kesehatan perempuan dengan pendekatan profesional dan penuh perhatian.", items: ["Konsultasi kebidanan", "Pemeriksaan kehamilan", "Kesehatan reproduksi"] },
    articles: { title: "Informasi untuk Anda", description: "Bacaan pilihan seputar kesehatan perempuan dan keluarga.", items: [
      { title: "Menjaga kesehatan selama kehamilan", excerpt: "Panduan awal untuk menjaga kesehatan ibu dan calon bayi." },
      { title: "Pentingnya pemeriksaan rutin", excerpt: "Kenali manfaat konsultasi dan pemeriksaan berkala." },
      { title: "Memahami kesehatan reproduksi", excerpt: "Informasi dasar untuk mengambil keputusan kesehatan." }
    ]},
    faq: { title: "Ada yang ingin ditanyakan?", description: "Temukan jawaban atas pertanyaan umum atau hubungi kami.", button: "Hubungi Kami", items: [
      { question: "Bagaimana cara membuat janji konsultasi?", answer: "Hubungi kami melalui WhatsApp untuk mendapatkan informasi jadwal." },
      { question: "Apa yang perlu disiapkan sebelum konsultasi?", answer: "Siapkan catatan keluhan dan hasil pemeriksaan sebelumnya jika ada." }
    ]},
    footer: { description: "Pendamping kesehatan perempuan dan keluarga.", copyright: "© 2026 Dr. Nabila. All rights reserved." }
  }
};
const clone = value => JSON.parse(JSON.stringify(value));
let config = clone(DEFAULT_CONFIG);
let activeSection = "hero";
let activePanel = "content";
let dirtyState = false;
let changeVersion = 0;
let saveInFlight = false;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[char]));
const sectionLabels = {hero:"Hero",about:"About",expertise:"Keahlian",articles:"Artikel",faq:"FAQ & CTA",footer:"Footer"};

function mergeDefaults(saved, defaults) {
  if (Array.isArray(defaults)) return Array.isArray(saved) ? saved : clone(defaults);
  if (defaults && typeof defaults === "object") {
    const result = {};
    Object.keys(defaults).forEach(key => result[key] = mergeDefaults(saved?.[key], defaults[key]));
    if (saved && typeof saved === "object") Object.keys(saved).forEach(key => {
      if (!(key in result)) result[key] = saved[key];
    });
    return result;
  }
  return saved === undefined || saved === null ? defaults : saved;
}
function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) config = mergeDefaults(JSON.parse(raw), DEFAULT_CONFIG);
  } catch (error) { console.warn("Draft Configurator tidak dapat dibaca:", error); }
}
function markDirty() {
  changeVersion += 1;
  dirtyState = true;
  const state = $("#saveState");
  if (state) { state.textContent = "● Belum disimpan"; state.style.color = "#b16a35"; }
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2300);
}
function setPath(path, value) {
  const keys = path.split(".");
  let target = config;
  keys.slice(0, -1).forEach(key => target = target[key]);
  target[keys[keys.length - 1]] = value;
  markDirty();
  renderPreview();
}
function field(label, path, value, limit, multiline = false, help = "") {
  const tag = multiline ? "textarea" : "input";
  const attrs = multiline ? ' rows="3"' : ' type="text"';
  return '<label class="field"><span>' + esc(label) + '</span><' + tag + ' data-path="' + path + '" maxlength="' + limit + '"' + attrs + '>' + (multiline ? esc(value) : "") + '</' + tag + '>' +
    (!multiline ? "" : "") + '<small class="counter">' + String(value ?? "").length + ' / ' + limit + ' karakter</small>' +
    (help ? '<small>' + esc(help) + '</small>' : '') + '</label>';
}
function bindDynamicFields() {
  $$("[data-path]").forEach(element => element.addEventListener("input", () => {
    setPath(element.dataset.path, element.value);
    const counter = element.parentElement.querySelector(".counter");
    if (counter) counter.textContent = element.value.length + " / " + element.maxLength + " karakter";
  }));
}
function renderEditor() {
  const section = config.sections[activeSection];
  let html = "";
  if (activeSection === "hero") {
    html = field("Judul utama","sections.hero.title",section.title,60) +
      field("Subjudul / tagline","sections.hero.subtitle",section.subtitle,160,true) +
      field("Deskripsi singkat","sections.hero.description",section.description,240,true) +
      field("Teks tombol","sections.hero.button",section.button,35);
  } else if (activeSection === "about") {
    html = field("Judul About","sections.about.title",section.title,80) +
      field("Deskripsi About","sections.about.description",section.description,500,true) +
      field("Teks tombol","sections.about.button",section.button,35);
  } else if (activeSection === "expertise") {
    html = field("Judul Keahlian","sections.expertise.title",section.title,80) +
      field("Deskripsi","sections.expertise.description",section.description,240,true) +
      section.items.map((item,index) => field("Layanan " + (index+1),"sections.expertise.items." + index,item,90)).join("") +
      '<button class="btn btn-outline" type="button" id="addExpertise">+ Tambah layanan</button>';
  } else if (activeSection === "articles") {
    html = field("Judul Artikel","sections.articles.title",section.title,80) +
      field("Deskripsi","sections.articles.description",section.description,220,true) +
      section.items.map((item,index) => '<div class="notice"><b>Artikel ' + (index+1) + '</b>' +
        field("Judul artikel","sections.articles.items." + index + ".title",item.title,90) +
        field("Ringkasan","sections.articles.items." + index + ".excerpt",item.excerpt,180,true) + '</div>').join("");
  } else if (activeSection === "faq") {
    html = field("Judul FAQ & CTA","sections.faq.title",section.title,80) +
      field("Deskripsi","sections.faq.description",section.description,220,true) +
      field("Teks tombol","sections.faq.button",section.button,35) +
      section.items.map((item,index) => '<div class="notice"><b>Pertanyaan ' + (index+1) + '</b>' +
        field("Pertanyaan","sections.faq.items." + index + ".question",item.question,160,true) +
        field("Jawaban","sections.faq.items." + index + ".answer",item.answer,400,true) + '</div>').join("");
  } else {
    html = field("Deskripsi Footer","sections.footer.description",section.description,180,true) +
      field("Copyright","sections.footer.copyright",section.copyright,100);
  }
  $("#contentFields").innerHTML = html;
  bindDynamicFields();
  const add = $("#addExpertise");
  if (add) add.addEventListener("click", () => {
    config.sections.expertise.items.push("Layanan baru");
    markDirty(); renderEditor(); renderPreview();
  });
}
function switchPanel(name) {
  activePanel = name;
  ["content","identity","contact","sections","media"].forEach(panel => $("#" + panel + "Panel").classList.toggle("hidden", panel !== name));
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.panel === name));
  const titles = {
    content:["Konten Website","Perbarui informasi yang tampil di website."],
    identity:["Identitas Visual","Kelola identitas dasar website."],
    contact:["Kontak & Sosial","Perbarui kanal komunikasi dan tautan sosial."],
    sections:["Daftar Section","Struktur website Paket 2 yang telah ditetapkan."],
    media:["Media Library","Kelola gambar untuk project aktif."]
  };
  $("#panelTitle").textContent = titles[name][0];
  $("#panelSubtitle").textContent = titles[name][1];
}
function normalizePhone(value) { return String(value || "").replace(/[^\d]/g, ""); }
function safeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try { const url = new URL(text); return ["http:","https:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}
function contactLinks() {
  const c = config.contact;
  const phone = normalizePhone(c.whatsapp);
  const links = [];
  if (phone) links.push('<a href="https://wa.me/' + esc(phone) + '">WhatsApp</a>');
  if (c.phone) links.push('<a href="tel:' + esc(c.phone.replace(/[^\d+]/g,"")) + '">Telepon</a>');
  if (c.email) links.push('<a href="mailto:' + esc(c.email) + '">Email</a>');
  ["instagram","facebook","youtube","maps"].forEach(key => {
    const url = safeUrl(c[key]);
    if (url) links.push('<a href="' + esc(url) + '" target="_blank" rel="noopener">' + key.charAt(0).toUpperCase() + key.slice(1) + '</a>');
  });
  return links.join("");
}
function mediaUrl(slot) {
  const item = config.media?.[slot];
  if (!item?.file || !config.project?.id) return "";
  return "backend/api/media.php?project_id=" + encodeURIComponent(config.project.id) + "&file=" + encodeURIComponent(item.file);
}
function renderPreview() {
  const s = config.sections;
  const logoSrc = config.logoDataUrl || mediaUrl("logo");
  const heroSrc = mediaUrl("hero");
  const aboutSrc = mediaUrl("about");
  const expertiseSrc = mediaUrl("expertise");
  const logo = logoSrc
    ? '<img src="' + esc(logoSrc) + '" alt="Logo ' + esc(config.brand) + '" style="max-height:42px;max-width:150px;object-fit:contain">'
    : '<span class="logo">' + esc(config.logoText || config.brand) + '</span>';
  const services = s.expertise.items.map(item => '<div class="card">' + esc(item) + '</div>').join("");
  const articles = s.articles.items.map(item => '<article class="card"><h3>' + esc(item.title) + '</h3><p>' + esc(item.excerpt) + '</p></article>').join("");
  const faqs = s.faq.items.map(item => '<details class="faq"><summary>' + esc(item.question) + '</summary><p>' + esc(item.answer) + '</p></details>').join("");
  const phone = normalizePhone(config.contact.whatsapp);
  const wa = phone ? "https://wa.me/" + phone : "#";
  const page = '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(config.brand) + '</title><style>' +
    '*{box-sizing:border-box}body{margin:0;color:#173c2b;font-family:Arial,sans-serif}.nav{min-height:68px;padding:10px 6%;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #edf0ed;gap:15px}.logo{font:600 18px Georgia}.links{font-size:11px;display:flex;gap:18px;color:#526358}.links a,.contact a{color:inherit;text-decoration:none}.hero{min-height:510px;padding:65px 7%;display:flex;align-items:center;position:relative;overflow:hidden;background:linear-gradient(110deg,#f7f1ed,#f9f8f4 60%,#e8eee5)}.copy{max-width:57%;position:relative;z-index:1}.kicker{font-size:10px;letter-spacing:2px;color:#7e9b76}.hero h1{font:600 clamp(34px,5vw,58px)/1.08 Georgia;margin:18px 0;color:#17462f}.hero h2{font:400 19px/1.45 Georgia;color:#36473b}.hero p,.section p{font-size:13px;line-height:1.7;color:#58665c;max-width:650px}.cta{display:inline-block;margin-top:16px;background:#245d3b;color:white;border-radius:30px;padding:13px 20px;text-decoration:none;font-size:11px}.portrait{position:absolute;right:4%;bottom:0;width:37%;height:88%;border-radius:180px 180px 0 0;background:linear-gradient(145deg,#e8d6d0,#dbe6d9);display:grid;place-items:center;color:#68806d;font:italic 14px Georgia;text-align:center;overflow:hidden}.portrait img{width:100%;height:100%;object-fit:cover}.section-image{display:block;width:min(340px,100%);max-height:260px;object-fit:cover;border-radius:14px;margin:22px auto 0}.section{padding:54px 8%;text-align:center;border-bottom:1px solid #edf0ed}.section h2{font:600 30px Georgia;color:#214a32}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-top:25px;text-align:left}.card{background:#f5f7f3;padding:20px;border-radius:12px;font-size:12px;color:#48614e}.card h3{font:600 17px Georgia}.card p{font-size:12px}.faq{max-width:720px;margin:10px auto;text-align:left;border:1px solid #e5ebe5;padding:15px;border-radius:9px;font-size:13px}.faq summary{cursor:pointer;font-weight:600}.faq p{margin-bottom:0}.contact{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin-top:20px;font-size:12px}.footer{padding:25px 8%;background:#163e2d;color:#dce9de;font-size:11px;display:flex;justify-content:space-between;gap:15px}.footer a{color:inherit}' +
    '@media(max-width:600px){.links{display:none}.hero{min-height:650px;padding:42px 8%;align-items:flex-start}.copy{max-width:100%}.hero h1{font-size:39px}.portrait{width:75%;height:38%;right:12%;opacity:.48}.cards{grid-template-columns:1fr}.footer{flex-direction:column}.section{padding:42px 7%}}' +
    '</style></head><body><header class="nav">' + logo + '<nav class="links"><a href="#top">Beranda</a><a href="#about">Tentang</a><a href="#expertise">Keahlian</a><a href="#articles">Artikel</a><a href="#faq">FAQ</a></nav></header>' +
    '<main id="top"><section class="hero"><div class="copy"><div class="kicker">PRAKTIK PROFESIONAL</div><h1>' + esc(s.hero.title) + '</h1><h2>' + esc(s.hero.subtitle) + '</h2><p>' + esc(s.hero.description) + '</p><a class="cta" href="' + esc(wa) + '">' + esc(s.hero.button) + ' →</a></div><div class="portrait">' + (heroSrc ? '<img src="' + esc(heroSrc) + '" alt="Foto utama">' : 'Area gambar utama website') + '</div></section>' +
    '<section class="section" id="about"><h2>' + esc(s.about.title) + '</h2><p>' + esc(s.about.description) + '</p>' + (aboutSrc ? '<img class="section-image" src="' + esc(aboutSrc) + '" alt="Foto profil">' : '') + '<a class="cta" href="' + esc(wa) + '">' + esc(s.about.button) + '</a></section>' +
    '<section class="section" id="expertise"><h2>' + esc(s.expertise.title) + '</h2><p>' + esc(s.expertise.description) + '</p>' + (expertiseSrc ? '<img class="section-image" src="' + esc(expertiseSrc) + '" alt="Foto keahlian">' : '') + '<div class="cards">' + services + '</div></section>' +
    '<section class="section" id="articles"><h2>' + esc(s.articles.title) + '</h2><p>' + esc(s.articles.description) + '</p><div class="cards">' + articles + '</div></section>' +
    '<section class="section" id="faq"><h2>' + esc(s.faq.title) + '</h2><p>' + esc(s.faq.description) + '</p>' + faqs + '<a class="cta" href="' + esc(wa) + '">' + esc(s.faq.button) + '</a></section></main>' +
    '<footer class="footer"><span><b>' + esc(config.brand) + '</b><br>' + esc(s.footer.description) + '<div class="contact">' + contactLinks() + '</div></span><span>' + esc(s.footer.copyright) + '</span></footer></body></html>';
  $("#sitePreview").srcdoc = page;
}
async function saveDraft() {
  if (saveInFlight) return;
  saveInFlight = true;
  const button = $("#saveButton");
  const startedAtVersion = changeVersion;
  try {
    config.project.updatedAt = new Date().toISOString();
    const snapshot = clone(config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    if (button) button.disabled = true;
    $("#saveState").textContent = "● Menyimpan...";
    $("#saveState").style.color = "#9a783b";
    const response = await fetch("backend/api/projects.php?id=" + encodeURIComponent(snapshot.project.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": window.MaximusAuth?.getToken?.() || "" },
      body: JSON.stringify(snapshot)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || "API PHP tidak tersedia atau project belum terdaftar.");
    if (changeVersion === startedAtVersion) {
      dirtyState = false;
      $("#saveState").textContent = "● Tersimpan di server";
      $("#saveState").style.color = "#66816e";
      showToast("Konfigurasi tersimpan melalui PHP.");
    } else {
      dirtyState = true;
      $("#saveState").textContent = "● Ada perubahan baru";
      $("#saveState").style.color = "#b16a35";
      showToast("Snapshot tersimpan. Perubahan terbaru masih perlu disimpan.");
    }
  } catch (error) {
    dirtyState = true;
    $("#saveState").textContent = "● Gagal disimpan";
    $("#saveState").style.color = "#b13f35";
    showToast("Penyimpanan server gagal. Draft lokal tetap tersedia.");
    console.error("Gagal menyimpan konfigurasi:", error);
  } finally {
    saveInFlight = false;
    if (button) button.disabled = false;
  }
}
function openPreview() {
  const previewWindow = window.open("", "_blank");
  if (!previewWindow) { showToast("Popup diblokir browser."); return; }
  previewWindow.document.open();
  previewWindow.document.write($("#sitePreview").srcdoc);
  previewWindow.document.close();
}
function bindStaticControls() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchPanel(button.dataset.panel)));
  $$(".section-tab").forEach(button => button.addEventListener("click", () => {
    activeSection = button.dataset.section;
    $$(".section-tab").forEach(tab => tab.classList.toggle("active", tab === button));
    renderEditor();
  }));
  $$("[data-bind]").forEach(element => {
    const path = element.dataset.bind;
    const keys = path.split(".");
    let value = config;
    keys.forEach(key => value = value?.[key]);
    element.value = value ?? "";
    element.addEventListener("input", () => {
      setPath(path, element.value);
      if (path === "brand" || path === "logoText") $("#logoPreview").textContent = (element.value || "M").slice(0,2).toUpperCase();
    });
  });
  $("#logoUpload").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type)) { showToast("Gunakan PNG, JPG, atau WebP."); return; }
    if (file.size > 500 * 1024) { showToast("Logo langsung maksimal 500 KB. Untuk file hingga 5 MB, gunakan Media Library."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      config.logoDataUrl = reader.result;
      $("#logoPreview").innerHTML = '<img alt="Logo preview" src="' + reader.result + '" style="max-width:100%;max-height:100%;object-fit:contain">';
      markDirty(); renderPreview();
    };
    reader.readAsDataURL(file);
  });
  $$("[data-device]").forEach(button => button.addEventListener("click", () => {
    $$("[data-device]").forEach(item => item.classList.toggle("active", item === button));
    $("#siteViewport").classList.toggle("mobile", button.dataset.device === "mobile");
  }));
  $("#saveButton").addEventListener("click", saveDraft);
  $("#openPreview").addEventListener("click", openPreview);
  $("#refreshPreview").addEventListener("click", () => { renderPreview(); showToast("Preview diperbarui."); });
  $("#showEditor").addEventListener("click", () => {
    $(".app-shell").classList.remove("show-preview");
    $("#showEditor").classList.add("active"); $("#showPreview").classList.remove("active");
  });
  $("#showPreview").addEventListener("click", () => {
    $(".app-shell").classList.add("show-preview");
    $("#showPreview").classList.add("active"); $("#showEditor").classList.remove("active");
  });
}
function initialize() {
  loadConfig();
  $("#projectName").textContent = config.project.name;
  $$("[data-bind]").forEach(element => {
    const keys = element.dataset.bind.split(".");
    let value = config;
    keys.forEach(key => value = value?.[key]);
    element.value = value ?? "";
  });
  const initialLogo = config.logoDataUrl || mediaUrl("logo");
  $("#logoPreview").innerHTML = initialLogo
    ? '<img alt="Logo preview" src="' + esc(initialLogo) + '" style="max-width:100%;max-height:100%;object-fit:contain">'
    : esc((config.logoText || "M").slice(0,2).toUpperCase());
  bindStaticControls();
  renderEditor();
  renderPreview();
  $("#saveState").textContent = "● " + (localStorage.getItem(STORAGE_KEY) ? "Draft dimuat" : "Draft demo");
}
window.MaximusConfigurator = {
  getConfig: () => clone(config),
  getDefaultConfig: () => clone(DEFAULT_CONFIG),
  hasUnsavedChanges: () => dirtyState,
  updateConfig: next => {
    config = mergeDefaults(next, DEFAULT_CONFIG);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (error) { console.warn("Draft lokal tidak dapat diperbarui:", error); }
    $("#projectName").textContent = config.project.name;
    $$("[data-bind]").forEach(element => { let value = config; element.dataset.bind.split(".").forEach(key => value = value?.[key]); element.value = value ?? ""; });
    const selectedLogo = config.logoDataUrl || mediaUrl("logo");
    $("#logoPreview").innerHTML = selectedLogo
      ? '<img alt="Logo preview" src="' + esc(selectedLogo) + '" style="max-width:100%;max-height:100%;object-fit:contain">'
      : esc((config.logoText || "M").slice(0,2).toUpperCase());
    renderEditor(); renderPreview(); markDirty();
  },
  setConfig: next => {
    config = mergeDefaults(next, DEFAULT_CONFIG);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (error) { console.warn("Draft lokal tidak dapat diperbarui:", error); }
    $("#projectName").textContent = config.project.name;
    $$("[data-bind]").forEach(element => { let value = config; element.dataset.bind.split(".").forEach(key => value = value?.[key]); element.value = value ?? ""; });
    const selectedLogo = config.logoDataUrl || mediaUrl("logo");
    $("#logoPreview").innerHTML = selectedLogo
      ? '<img alt="Logo preview" src="' + esc(selectedLogo) + '" style="max-width:100%;max-height:100%;object-fit:contain">'
      : esc((config.logoText || "M").slice(0,2).toUpperCase());
    renderEditor(); renderPreview(); dirtyState = false;
  },
  setProjectName: name => { config.project.name = name; $("#projectName").textContent = name; },
  toast: showToast
};
initialize();
