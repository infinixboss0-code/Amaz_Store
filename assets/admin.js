// Admin frontend: login, product management, viewing clicks
let token = null;

function showLogin(show){ document.getElementById('loginCard').style.display = show? 'block':'none'; document.getElementById('adminPanel').style.display = show? 'none':'block'; }

document.getElementById('loginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const res = await fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password})});
  const data = await res.json();
  if(res.ok){ token = data.token; localStorage.setItem('paksar_token', token); initAdmin(); } else { document.getElementById('loginMsg').style.display='block'; document.getElementById('loginMsg').textContent = data.message || 'Login failed'; }
});

document.getElementById('logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('paksar_token'); token=null; showLogin(true); });

function authHeaders(){ return token? { 'Authorization':'Bearer '+token } : {}; }

async function initAdmin(){
  token = token || localStorage.getItem('paksar_token');
  if(!token){ showLogin(true); return; }
  // try to fetch products
  const res = await fetch('/api/products', {headers: authHeaders()});
  if(res.status===401){ showLogin(true); return; }
  showLogin(false);
  loadProductsForAdmin();
  loadClicks();
  // load settings
  const sres = await fetch('/api/settings', {headers: authHeaders()}); if(sres.ok){ const s=await sres.json(); document.getElementById('affiliateTag').value = s.affiliateTag || ''; document.getElementById('adminEmail').value = s.adminEmail || ''; }
}

async function loadProductsForAdmin(){
  const res = await fetch('/api/products', {headers: authHeaders()});
  const data = await res.json();
  const container = document.getElementById('productsList');
  container.innerHTML = '';
  data.products.forEach(p=>{
    const div = document.createElement('div'); div.className='card p-3 mb-2';
    div.innerHTML = `<div class="d-flex align-items-center"><img src="${p.image}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;margin-right:12px"><div style="flex:1"><b>${p.title}</b><div class="text-muted small">${p.asin} • ${p.category}</div></div><div><button class="btn btn-sm btn-primary me-1" data-asin="${p.asin}" onclick="editProduct('${p.asin}')">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.asin}')">Delete</button></div></div>`;
    container.appendChild(div);
  });
}

window.editProduct = async function(asin){
  const res = await fetch('/api/products/'+asin, {headers: authHeaders()});
  if(!res.ok) return alert('Failed to load');
  const p = await res.json();
  const title = prompt('Title', p.title); if(title===null) return;
  const price = prompt('Price', p.price); if(price===null) return;
  const category = prompt('Category', p.category); if(category===null) return;
  const image = prompt('Image URL', p.image); if(image===null) return;
  const body = { title, price, category, image };
  const up = await fetch('/api/products/'+asin, {method:'PUT', headers: {...authHeaders(), 'Content-Type':'application/json'}, body: JSON.stringify(body)});
  if(up.ok){ alert('Updated'); loadProductsForAdmin(); } else alert('Update failed');
}

window.deleteProduct = async function(asin){ if(!confirm('Delete product?')) return; const res = await fetch('/api/products/'+asin, {method:'DELETE', headers: authHeaders()}); if(res.ok){ loadProductsForAdmin(); } else alert('Delete failed'); }

document.getElementById('addNewBtn').addEventListener('click', async ()=>{
  const asin = prompt('ASIN'); if(!asin) return;
  const title = prompt('Title') || asin;
  const price = prompt('Price') || 'Check on Amazon';
  const category = prompt('Category') || 'General';
  const image = prompt('Image URL') || '/assets/placeholder.png';
  const res = await fetch('/api/products', {method:'POST', headers: {...authHeaders(), 'Content-Type':'application/json'}, body: JSON.stringify({asin,title,price,category,image})});
  if(res.ok){ loadProductsForAdmin(); } else alert('Add failed');
});

// clicks
async function loadClicks(){
  const res = await fetch('/api/clicks', {headers: authHeaders()});
  const data = await res.json();
  const tbody = document.getElementById('clicksTbody'); tbody.innerHTML = '';
  data.clicks.forEach((c,i)=>{ const tr=document.createElement('tr'); tr.innerHTML = `<td>${i+1}</td><td>${c.time}</td><td>${c.asin}</td><td>${c.title}</td><td>${c.referrer||''}</td>`; tbody.appendChild(tr); });
}

document.getElementById('refreshClicks').addEventListener('click', loadClicks);
document.getElementById('clearClicks').addEventListener('click', async ()=>{ if(!confirm('Clear clicks?')) return; await fetch('/api/clicks', {method:'DELETE', headers: authHeaders()}); loadClicks(); });
document.getElementById('downloadClicks').addEventListener('click', async ()=>{ const res = await fetch('/api/clicks', {headers: authHeaders()}); const data = await res.json(); if(!data.clicks.length) return alert('No clicks'); const csv=[['time','asin','title','url','referrer']]; data.clicks.forEach(c=>csv.push([c.time,c.asin,`"${(c.title||'').replace(/"/g,'""')}"`,c.url,c.referrer||''])); const blob=new Blob([csv.map(r=>r.join(',')).join('\n')], {type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='clicks.csv'; a.click(); });

document.getElementById('saveSettings').addEventListener('click', async ()=>{
  const body = { affiliateTag: document.getElementById('affiliateTag').value.trim(), adminEmail: document.getElementById('adminEmail').value.trim() };
  const res = await fetch('/api/settings', {method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body: JSON.stringify(body)});
  if(res.ok) alert('Saved'); else alert('Failed');
});

async function init(){ token = localStorage.getItem('paksar_token'); if(token) initAdmin(); else showLogin(true); }
init();