/* Maximus Configurator — admin session gate */
(() => {
  document.body.classList.add("auth-locked");
  const API="backend/api/auth.php";
  let csrfToken="";
  const overlay=document.createElement("div");
  overlay.id="maximusAuthGate";
  overlay.className="auth-gate";
  overlay.innerHTML='<form class="auth-card" id="maximusLoginForm"><div class="auth-mark">M</div><p class="auth-eyebrow">MAXIMUS WORKSPACE</p><h1>Admin Login</h1><p class="auth-copy">Masuk untuk mengelola project dan media Configurator.</p><label for="maximusPassword">Password admin</label><input id="maximusPassword" type="password" autocomplete="current-password" required maxlength="200" placeholder="Masukkan password admin"><button type="submit" id="maximusLoginButton">Masuk ke Configurator</button><p id="maximusAuthMessage" role="status" aria-live="polite"></p></form>';
  document.body.appendChild(overlay);
  const message=text=>{const el=document.querySelector("#maximusAuthMessage");if(el)el.textContent=text;};
  async function request(method,body){
    const response=await fetch(API,{method,headers:{"Content-Type":"application/json",...(csrfToken?{"X-CSRF-Token":csrfToken}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok===false)throw new Error(data.error||"Autentikasi gagal.");
    return data;
  }
  function unlock(token){
    csrfToken=token||"";
    document.body.classList.remove("auth-locked");
    overlay.remove();
    const topbar=document.querySelector(".top-actions");
    if(topbar&&!document.querySelector("#maximusLogout")){
      const button=document.createElement("button");
      button.type="button";button.id="maximusLogout";button.className="btn btn-outline";button.textContent="Keluar";
      button.addEventListener("click",async()=>{
        if(!confirm("Keluar dari Maximus Configurator?"))return;
        try{await request("DELETE");location.reload();}catch(error){alert(error.message);}
      });
      topbar.appendChild(button);
    }
  }
  window.MaximusAuth={getToken:()=>csrfToken};
  document.addEventListener("submit",async event=>{
    if(event.target.id!=="maximusLoginForm")return;
    event.preventDefault();
    const button=document.querySelector("#maximusLoginButton");
    button.disabled=true;button.textContent="Memeriksa...";
    try{
      const data=await request("POST",{password:document.querySelector("#maximusPassword").value});
      csrfToken=data.csrfToken||"";
      location.reload();
    }catch(error){message(error.message);}
    finally{button.disabled=false;button.textContent="Masuk ke Configurator";}
  });
  (async()=>{
    try{
      const data=await request("GET");
      if(data.authenticated)unlock(data.csrfToken);
      else message("Silakan masukkan password admin.");
    }catch(error){message(error.message);}
  })();
})();
