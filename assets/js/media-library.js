/* Media Library: project-scoped PHP media API */
(() => {
  const API="backend/api/media.php";
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const activeId=()=>window.MaximusConfigurator?.getConfig()?.project?.id||"";
  const endpoint=()=>API+"?project_id="+encodeURIComponent(activeId());
  const request=async(url,options={})=>{
    const res=await fetch(url,options);const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false)throw new Error(data.error||"Media API gagal.");
    return data;
  };
  const grid=$("#mediaGrid");
  if(!grid)return;
  let urls=[];
  function revoke(){urls.forEach(URL.revokeObjectURL);urls=[];}
  async function load(){
    revoke();
    if(!activeId()){grid.innerHTML='<p class="media-empty">Pilih project terlebih dahulu.</p>';return;}
    try{
      const data=await request(endpoint());
      if(!data.media.length){grid.innerHTML='<p class="media-empty">Belum ada gambar di project ini.</p>';return;}
      grid.innerHTML=data.media.map(item=>'<article class="media-card"><div class="media-thumb" data-thumb="'+esc(item.file)+'">Memuat…</div><div class="media-meta"><small>'+esc(item.file)+'</small><small>'+Math.round(item.bytes/1024)+' KB</small><div class="media-actions"><button type="button" data-use="'+esc(item.file)+'">Pilih</button><button type="button" class="danger" data-remove="'+esc(item.file)+'">Hapus</button></div></div></article>').join("");
      for(const item of data.media){
        const response=await fetch(API+"?project_id="+encodeURIComponent(activeId())+"&file="+encodeURIComponent(item.file));
        if(!response.ok)continue;
        const url=URL.createObjectURL(await response.blob());urls.push(url);
        const thumb=grid.querySelector('[data-thumb="'+CSS.escape(item.file)+'"]');
        if(thumb)thumb.innerHTML='<img src="'+url+'" alt="'+esc(item.file)+'">';
      }
      grid.querySelectorAll("[data-use]").forEach(button=>button.addEventListener("click",()=>useMedia(button.dataset.use)));
      grid.querySelectorAll("[data-remove]").forEach(button=>button.addEventListener("click",()=>removeMedia(button.dataset.remove)));
    }catch(e){grid.innerHTML='<p class="media-empty">'+esc(e.message)+'</p>';}
  }
  function useMedia(file){
    const target=$("#mediaTarget")?.value||"hero";
    const cfg=window.MaximusConfigurator.getConfig();
    cfg.media=cfg.media||{logo:null,hero:null,about:null,expertise:null};
    cfg.media[target]={file};
    if(target==="logo")cfg.logoDataUrl="";
    window.MaximusConfigurator.setConfig(cfg);
    const labels={hero:"Hero utama",about:"Foto About",expertise:"Foto Keahlian",logo:"Logo website"};
    window.MaximusConfigurator.toast("Gambar berhasil dipasang: "+labels[target]+".");
  }
  async function upload(){
    const input=$("#mediaFile");const file=input.files?.[0];if(!file)return window.MaximusConfigurator.toast("Pilih gambar terlebih dahulu.");
    if(!["image/jpeg","image/png","image/webp"].includes(file.type))return window.MaximusConfigurator.toast("Format harus JPG, PNG, atau WebP.");
    if(file.size>5*1024*1024)return window.MaximusConfigurator.toast("Ukuran maksimal 5 MB.");
    const form=new FormData();form.append("file",file);
    try{await request(endpoint(),{method:"POST",body:form});input.value="";await load();window.MaximusConfigurator.toast("Gambar berhasil diunggah.");}
    catch(e){window.MaximusConfigurator.toast(e.message);}
  }
  async function removeMedia(file){
    if(!confirm("Hapus file "+file+" dari project ini?"))return;
    try{await request(endpoint()+"&file="+encodeURIComponent(file),{method:"DELETE"});await load();window.MaximusConfigurator.toast("Media dihapus.");}
    catch(e){window.MaximusConfigurator.toast(e.message);}
  }
  $("#uploadMedia").addEventListener("click",upload);
  $("#refreshMedia").addEventListener("click",load);
  document.querySelector('[data-panel="media"]').addEventListener("click",load);
  window.addEventListener("maximus:project-changed",load);
})();
