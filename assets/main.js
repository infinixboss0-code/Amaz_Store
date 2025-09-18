// Frontend main.js - fetch products from /api/products and render; track clicks via /api/track
const productsRow = document.getElementById('productsRow');
const categorySelect = document.getElementById('categorySelect');
const searchInput = document.getElementById('searchInput');
const noResults = document.getElementById('noResults');
let PRODUCTS = [];
let AFF_TAG = 'PakSarSeller-20';

function buildLink(asin){ return `/r/${asin}`; } // redirect route (server will record and forward)

function escapeHtml(s){ return String(s).replace(/[&<>"'`=\/]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#47;','`':'&#96;','=':'&#61;'}[c])); }

function render(list){
  productsRow.innerHTML = '';
  if(!list.length){ noResults.style.display='block'; return; } else noResults.style.display='none';
  list.forEach(p=>{
    const col = document.createElement('div'); col.className='col-6 col-md-4 col-lg-3';
    col.innerHTML = `
      <article class="product-card">
        <img class="card-media" src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy">
        <div class="card-body-custom">
          <div class="card-title">${escapeHtml(p.title)}</div>
          <div class="card-meta mb-2"><span class="badge-cat">${escapeHtml(p.category)}</span> <span class="price ms-2">${escapeHtml(p.price)}</span></div>
          <a class="btn-buy" href="${buildLink(p.asin)}" target="_blank" rel="noopener noreferrer" data-asin="${p.asin}">Buy on Amazon</a>
        </div>
      </article>
    `;
    productsRow.appendChild(col);
  });
}

async function loadProducts(){
  try{
    const res = await fetch('/api/products');
    if(!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    PRODUCTS = data.products || [];
    AFF_TAG = data.affiliateTag || AFF_TAG;
    populateCategories();
    render(PRODUCTS);
  }catch(err){ console.error(err); }
}

function populateCategories(){
  const cats = new Set(PRODUCTS.map(p=>p.category));
  categorySelect.innerHTML = '<option value="all">All Categories</option>';
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; categorySelect.appendChild(o); });
}

function filterAndRender(){
  const q = searchInput.value.trim().toLowerCase();
  const cat = categorySelect.value;
  const filtered = PRODUCTS.filter(p=> (cat==='all' || p.category===cat) && (!q || (p.title+p.asin+p.category).toLowerCase().includes(q)));
  render(filtered);
}

categorySelect.addEventListener('change', filterAndRender);
searchInput.addEventListener('input', filterAndRender);

loadProducts();