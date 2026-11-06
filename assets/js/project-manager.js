/* Project Manager — PHP API adapter */
(() => {
  const API = "backend/api/projects.php";
  const $ = s => document.querySelector(s);
  const api = async (url, options={}) => {
    const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers||{}) }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || "Permintaan ke server gagal.");
    return data;
  };
  let projects = [];
  const managerButton = $("#manageProjects");
  if (!managerButton) return;

  function renderManager() {
    let modal = $("#projectManagerModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "projectManagerModal";
      modal.className = "pm-overlay";
      modal.innerHTML = '<section class="pm-dialog" role="dialog" aria-modal="true" aria-labelledby="pmTitle"><header><div><small>MAXIMUS WORKSPACE</small><h2 id="pmTitle">Project Manager</h2></div><button type="button" class="pm-close" aria-label="Tutup">×</button></header><p class="pm-help">Setiap project memiliki file konfigurasi dan ruang media tersendiri.</p><div class="pm-create"><input id="pmNewName" maxlength="100" placeholder="Nama project baru"><button id="pmCreate" class="btn btn-primary" type="button">+ Buat</button></div><div id="pmList" class="pm-list"></div><footer><span id="pmStatus">Terhubung ke PHP API</span></footer></section>';
      document.body.appendChild(modal);
      modal.addEventListener("click", e => { if (e.target === modal || e.target.closest(".pm-close")) modal.classList.remove("show"); });
      $("#pmCreate").addEventListener("click", createProject);
    }
    const activeId = window.MaximusConfigurator.getConfig().project.id;
    $("#pmList").innerHTML = projects.map(p => '<article class="pm-item"><div><b>'+escapeHtml(p.name)+'</b><small>'+escapeHtml(p.package || "paket-2")+' · '+escapeHtml(p.id)+'</small></div><div class="pm-actions"><button type="button" data-open="'+escapeHtml(p.id)+'">Buka</button><button type="button" data-rename="'+escapeHtml(p.id)+'">Nama</button><button type="button" data-delete="'+escapeHtml(p.id)+'" class="danger">Hapus</button></div>'+(p.id===activeId?'<em>Aktif</em>':'')+'</article>').join("") || '<p class="pm-empty">Belum ada project.</p>';
    $("#pmList").querySelectorAll("[data-open]").forEach(b=>b.addEventListener("click",()=>openProject(b.dataset.open)));
    $("#pmList").querySelectorAll("[data-rename]").forEach(b=>b.addEventListener("click",()=>renameProject(b.dataset.rename)));
    $("#pmList").querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",()=>deleteProject(b.dataset.delete)));
    modal.classList.add("show");
  }
  function escapeHtml(v) { return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  async function refresh() { const result=await api(API); projects=result.projects||[]; }
  async function createProject() {
    const name=$("#pmNewName").value.trim();
    if(!name) { $("#pmStatus").textContent="Masukkan nama project."; return; }
    try {
      const base=window.MaximusConfigurator.getConfig();
      base.project={id:"",name,package:"paket-2"};
      const result=await api(API,{method:"POST",body:JSON.stringify({name,config:base})});
      await refresh(); await openProject(result.project.id); $("#pmNewName").value=""; renderManager();
    } catch(e) { $("#pmStatus").textContent=e.message; }
  }
  async function openProject(id) {
    try {
      const result=await api(API+"?id="+encodeURIComponent(id));
      window.MaximusConfigurator.setConfig(result.config);
      window.dispatchEvent(new Event("maximus:project-changed"));
      await refresh(); renderManager();
      $("#pmStatus").textContent="Project aktif: "+result.config.project.name;
    } catch(e) { $("#pmStatus").textContent=e.message; }
  }
  async function renameProject(id) {
    const p=projects.find(x=>x.id===id); if(!p) return;
    const name=prompt("Nama project baru:",p.name); if(name===null) return;
    const clean=name.trim(); if(!clean) return;
    try {
      const result=await api(API+"?id="+encodeURIComponent(id));
      result.config.project.name=clean;
      await api(API+"?id="+encodeURIComponent(id),{method:"PUT",body:JSON.stringify(result.config)});
      if(window.MaximusConfigurator.getConfig().project.id===id) window.MaximusConfigurator.setConfig(result.config);
      await refresh(); renderManager();
    } catch(e) { $("#pmStatus").textContent=e.message; }
  }
  async function deleteProject(id) {
    const p=projects.find(x=>x.id===id); if(!p) return;
    if(!confirm('Hapus project "'+p.name+'" beserta konfigurasi dan medianya?')) return;
    try {
      await api(API+"?id="+encodeURIComponent(id),{method:"DELETE"});
      await refresh();
      if(window.MaximusConfigurator.getConfig().project.id===id) {
        if(projects.length) await openProject(projects[0].id);
        else await createProjectFromDefault();
      }
      renderManager();
    } catch(e) { $("#pmStatus").textContent=e.message; }
  }
  async function createProjectFromDefault() {
    const base=window.MaximusConfigurator.getConfig();
    const name="Project Baru";
    const result=await api(API,{method:"POST",body:JSON.stringify({name,config:base})});
    const loaded=await api(API+"?id="+encodeURIComponent(result.project.id));
    window.MaximusConfigurator.setConfig(loaded.config); await refresh();
  }
  managerButton.addEventListener("click",async()=>{ try { await refresh(); renderManager(); } catch(e) { window.MaximusConfigurator.toast("PHP API belum dapat dijangkau: "+e.message); }});
  (async()=>{
    try {
      await refresh();
      if(!projects.length) {
        const base=window.MaximusConfigurator.getConfig();
        const result=await api(API,{method:"POST",body:JSON.stringify({name:base.project.name,config:base})});
        await refresh();
        const loaded=await api(API+"?id="+encodeURIComponent(result.project.id));
        window.MaximusConfigurator.setConfig(loaded.config);
      } else {
        const current=window.MaximusConfigurator.getConfig().project.id;
        if(!projects.some(p=>p.id===current)) await openProject(projects[0].id);
      }
    } catch(e) {
      console.warn("Project Manager menunggu PHP API:",e.message);
      $("#saveState").textContent="● PHP API belum terhubung";
    }
  })();
})();
