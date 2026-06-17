const CATS = ["Bookcases","Boxes","Seating","Chests of drawers","Cupboards","Desks","Dressers","Tables","Wardrobes","Beds & Miscellaneous"];

const CAT_PAGES = {
  "Bookcases":            "antique-pine-bookcases",
  "Boxes":                "antique-pine-boxes-chests",
  "Seating":              "pine-benches-chairs",
  "Chests of drawers":    "antique-pine-chests-of-drawers",
  "Cupboards":            "antique-pine-cupboards",
  "Desks":                "antique-pine-desks",
  "Dressers":             "antique-pine-dressers",
  "Tables":               "pine-tables",
  "Wardrobes":            "antique-pine-wardrobes",
  "Beds & Miscellaneous": "miscellaneous-furniture"
};

let items = [];
let nextId = 0;
let editId = null;

// Showroom backdrop — persists across photo sessions
let backdrop = null;
let backdropName = '';

// Photo tool state
const pt = {
  original: null,   // original uploaded image data URL
  cutout: null,     // transparent PNG from Remove.bg
  current: null,    // current displayed/downloadable image
  bgMode: 'blur',
  processing: false,
  filename: 'photo',
  roomImage: null,       // generated room image
  roomProcessing: false
};

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function toSlug(str){ return str.toLowerCase().replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim(); }

function buildFullTitle(item){ return item.title + ' (' + item.code + ')'; }
function buildPriceLine(item){
  if(item.single) return 'Price: £' + item.priceRestored + ' fully restored and waxed.';
  return 'Price: £' + item.priceCurrent + ' in current condition, or £' + item.priceRestored + ' fully restored and waxed.';
}
function buildDimLine(item){
  let line = 'Dimensions: Height ' + item.height + ', width ' + item.width + ', depth ' + item.depth + '.';
  if(item.extra) line += ' ' + item.extra + '.';
  return line;
}
function buildFullDescription(item){
  return item.description + '\n\n' + 'Code: ' + item.code + '\n\n' + buildPriceLine(item) + '\n\n' + buildDimLine(item);
}
function buildHtmlDescription(item){
  return buildFullDescription(item).split('\n\n')
    .map(p => '<p>' + p.trim().replace(/\n/g,' ').replace(/£/g,'&pound;') + '</p>')
    .join('');
}

// ── Panel toggle ──────────────────────────────────────────────
function togglePanel(id){
  const body  = document.getElementById(id+'-body');
  const header= document.getElementById(id+'-header');
  const arrow = document.getElementById(id+'-arrow');
  const open  = body.classList.contains('open');
  body.classList.toggle('open', !open);
  header.classList.toggle('open', !open);
  arrow.classList.toggle('open', !open);
}

// ── Transcript processing ─────────────────────────────────────
async function processTranscript(){
  const transcript = document.getElementById('transcript-input').value.trim();
  if(!transcript){ showError('Please paste a transcript first.'); return; }
  const btn = document.getElementById('process-btn');
  const msg = document.getElementById('processing-msg');
  const errEl = document.getElementById('error-msg');
  btn.disabled = true; msg.style.display = 'flex'; errEl.style.display = 'none';
  try {
    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || 'Something went wrong.');
    if(!Array.isArray(data.items) || data.items.length === 0)
      throw new Error('No items were extracted. Please check the transcript and try again.');
    data.items.forEach(item => {
      items.push({
        id: nextId++,
        title: item.title || '',
        code: item.code || '',
        category: item.category || 'Beds & Miscellaneous',
        description: item.description || '',
        priceCurrent:  Number(item.priceCurrent)  || 0,
        priceRestored: Number(item.priceRestored)  || 0,
        single: !!item.single,
        height: item.height || '',
        width:  item.width  || '',
        depth:  item.depth  || '',
        extra:  item.extra  || '',
        approved: false,
        flag: null
      });
    });
    document.getElementById('transcript-input').value = '';
    togglePanel('transcript');
    render();
  } catch(err){
    showError(err.message);
  } finally {
    btn.disabled = false; msg.style.display = 'none';
  }
}
function showError(msg){
  const el = document.getElementById('error-msg');
  el.textContent = '⚠️ ' + msg; el.style.display = 'block';
}

// ── Photo Tool ────────────────────────────────────────────────
function ptLoadPhoto(input){
  const files = input.files || input;
  const file = files[0];
  if(!file) return;
  pt.filename = file.name.replace(/\.[^.]+$/, '') || 'photo';
  pt.cutout = null;
  pt.bgMode = 'blur';
  // Show immediately with blob URL — synchronous, no callbacks
  if(pt.original && pt.original.startsWith('blob:')) URL.revokeObjectURL(pt.original);
  pt.original = URL.createObjectURL(file);
  pt.current  = pt.original;
  ptUpdateUI();
  // Convert to data URL in background so canvas/API calls work
  const r = new FileReader();
  r.onload = e => {
    URL.revokeObjectURL(pt.original);
    pt.original = e.target.result;
    if(!pt.cutout) pt.current = pt.original;
  };
  r.readAsDataURL(file);
}

function ptUpdateUI(){
  const hasPhoto = !!pt.original;
  document.getElementById('pt-upload-area').style.display    = hasPhoto ? 'none' : 'block';
  document.getElementById('pt-workspace-wrap').style.display = hasPhoto ? 'block' : 'none';
  if(hasPhoto){
    document.getElementById('pt-img').src = pt.current || pt.original;
    document.getElementById('pt-toggle-row').style.display = pt.cutout ? 'block' : 'none';
    const blurBtn     = document.getElementById('pt-blur-btn');
    const whiteBtn    = document.getElementById('pt-white-btn');
    const showroomBtn = document.getElementById('pt-showroom-btn');
    if(blurBtn)     blurBtn.classList.toggle('active',     pt.bgMode === 'blur');
    if(whiteBtn)    whiteBtn.classList.toggle('active',    pt.bgMode === 'white');
    if(showroomBtn) showroomBtn.classList.toggle('active', pt.bgMode === 'showroom');
    const backdropHint = document.getElementById('pt-backdrop-hint');
    const backdropNameEl = document.getElementById('pt-backdrop-name');
    if(backdropHint){ backdropHint.style.display = backdrop ? 'block' : 'none'; }
    if(backdropNameEl && backdropName) backdropNameEl.textContent = backdropName;
    const removeBtn = document.getElementById('pt-removebg-btn');
    if(removeBtn){
      removeBtn.disabled = pt.processing;
      removeBtn.innerHTML = pt.processing
        ? '<span class="pt-spinner"></span> Removing background…'
        : '✂ Remove Background';
    }
    // Room section
    const roomBtn    = document.getElementById('pt-room-btn');
    const regenBtn   = document.getElementById('pt-regen-btn');
    const roomResult = document.getElementById('pt-room-result');
    const roomImg    = document.getElementById('pt-room-img');
    const showroomRoomBtn = document.getElementById('pt-showroom-room-btn');
    if(roomBtn){
      roomBtn.disabled = pt.roomProcessing;
      roomBtn.innerHTML = pt.roomProcessing
        ? '<span class="pt-spinner"></span> Generating…'
        : '🏠 Place in Room';
    }
    if(showroomRoomBtn){
      showroomRoomBtn.style.display = backdrop ? 'flex' : 'none';
      showroomRoomBtn.disabled = pt.roomProcessing;
      showroomRoomBtn.innerHTML = pt.roomProcessing
        ? '<span class="pt-spinner"></span> Generating…'
        : '📸 Place in My Showroom';
    }
    if(regenBtn)   regenBtn.style.display   = (pt.roomImage && !pt.roomProcessing) ? 'flex' : 'none';
    if(roomResult) roomResult.style.display = pt.roomImage ? 'block' : 'none';
    if(roomImg && pt.roomImage) roomImg.src = pt.roomImage;
  }
}

function ptClear(){
  if(pt.original && pt.original.startsWith('blob:')) URL.revokeObjectURL(pt.original);
  pt.original = null; pt.cutout = null; pt.current = null;
  pt.bgMode = 'blur'; pt.processing = false; pt.filename = 'photo';
  pt.roomImage = null; pt.roomProcessing = false;
  document.getElementById('pt-file-input').value = '';
  ptUpdateUI();
}

async function ptGenerateRoom(){
  if(!pt.original || pt.roomProcessing) return;
  let prompt = document.getElementById('pt-room-prompt').value.trim();
  if(!prompt){ alert('Please enter a prompt first.'); return; }
  const furnitureType = document.getElementById('pt-room-type').value.trim()   || 'antique pine furniture';
  const height        = document.getElementById('pt-room-height').value.trim() || 'not specified';
  const width         = document.getElementById('pt-room-width').value.trim()  || 'not specified';
  const depth         = document.getElementById('pt-room-depth').value.trim()  || 'not specified';
  const fullPrompt = prompt
    .replace('[FURNITURE TYPE]', furnitureType)
    .replace('[HEIGHT]', height)
    .replace('[WIDTH]', width)
    .replace('[DEPTH]', depth);
  pt.roomProcessing = true;
  ptUpdateUI();
  try {
    const compressed = await compressImage(pt.original, 1500, 0.88);
    const res = await fetch('/api/gemini-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: compressed, prompt: fullPrompt })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || 'Failed to generate room image.');
    pt.roomImage = data.imageBase64;
  } catch(err){
    alert('Room generation failed: ' + err.message);
  } finally {
    pt.roomProcessing = false;
    ptUpdateUI();
  }
}

async function ptGenerateShowroom(){
  if(!pt.original || !backdrop || pt.roomProcessing) return;
  const furnitureType = document.getElementById('pt-room-type').value.trim()   || 'antique pine furniture';
  const height        = document.getElementById('pt-room-height').value.trim() || 'not specified';
  const width         = document.getElementById('pt-room-width').value.trim()  || 'not specified';
  const depth         = document.getElementById('pt-room-depth').value.trim()  || 'not specified';

  const showroomPrompt = `You are provided with two reference images:

1. A photograph of a piece of furniture.
2. A photograph showing the Pinefinders showroom wall and carpet.

Create a photorealistic image of the furniture displayed naturally within the showroom environment.

IMPORTANT
The showroom image is a reference for the appearance of the environment, not a fixed background.
Learn and preserve:
* The wall colour and texture
* The carpet colour and texture
* The overall lighting style
* The character and appearance of the showroom

You may change the camera position, viewing angle, perspective and composition as needed.
Do not simply paste the furniture onto the supplied wall photograph.
Instead, recreate the same showroom environment realistically from whatever angle is required to produce the best furniture photograph.

FURNITURE PLACEMENT
Furniture type: ${furnitureType}
Dimensions:
* Height: ${height}
* Width: ${width}
* Depth: ${depth}

Use the supplied dimensions to maintain accurate real-world scale.
Position the furniture naturally and realistically.
Examples:
* Wardrobes, cupboards, bookcases and chests of drawers should normally be placed against the wall.
* Tables, desks and dining tables may be positioned away from the wall where appropriate.
* Benches, chairs and other freestanding items should be positioned naturally according to their function.
* The furniture must never appear to float, intersect walls, sink into the carpet or appear incorrectly scaled.

FURNITURE PRESERVATION
Preserve the furniture exactly as shown in the reference image.
Do not alter: design, proportions, colour, finish, handles, hardware, doors, drawers, shelves, surface character, wear, marks or patina.
Do not add or remove features.

PHOTOGRAPHY REQUIREMENTS
Create the image as though it were photographed professionally for an antique furniture sales listing.
Use:
* Natural perspective
* Realistic room depth
* Accurate shadows and contact shadows where the furniture meets the carpet
* Realistic lighting
* High-resolution photorealistic quality

The furniture must remain the primary subject.

ENVIRONMENT CONSISTENCY
The resulting image should clearly look as though it was photographed within the same showroom represented by the reference wall and carpet image, even when viewed from a different angle.
The wall, carpet, colours, textures and overall appearance should remain consistent.

FINAL RESULT
Produce a realistic showroom photograph that appears to have been taken inside the actual Pinefinders showroom, with the furniture correctly scaled, naturally positioned and professionally photographed.`;

  pt.roomProcessing = true;
  ptUpdateUI();
  try {
    const furnitureCompressed = await compressImage(pt.original, 1500, 0.88);
    const backdropCompressed  = await compressImage(backdrop,    1500, 0.88);
    const res = await fetch('/api/gemini-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: furnitureCompressed,
        backdropBase64: backdropCompressed,
        prompt: showroomPrompt
      })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || 'Failed to generate showroom image.');
    pt.roomImage = data.imageBase64;
  } catch(err){
    alert('Showroom generation failed: ' + err.message);
  } finally {
    pt.roomProcessing = false;
    ptUpdateUI();
  }
}

function ptDownloadRoom(){
  if(!pt.roomImage) return;
  const a = document.createElement('a');
  a.href = pt.roomImage;
  a.download = (pt.filename || 'photo') + '-room.png';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function ptDownload(){
  if(!pt.current) return;
  const a = document.createElement('a');
  a.href = pt.current;
  a.download = pt.filename + '.png';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function compressImage(dataUrl, maxPx, quality){
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if(w > maxPx || h > maxPx){
        if(w > h){ h = Math.round(h * maxPx / w); w = maxPx; }
        else { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

function compositeImage(cutoutSrc, backgroundSrc, mode){
  return new Promise(resolve => {
    const cutout = new Image();
    cutout.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cutout.width; canvas.height = cutout.height;
      const ctx = canvas.getContext('2d');
      if((mode === 'blur' || mode === 'showroom') && backgroundSrc){
        const bg = new Image();
        bg.onload = () => {
          const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
          const sw = bg.width * scale, sh = bg.height * scale;
          const sx = (canvas.width - sw) / 2, sy = (canvas.height - sh) / 2;
          if(mode === 'blur') ctx.filter = 'blur(9px)';
          ctx.drawImage(bg, sx, sy, sw, sh);
          ctx.filter = 'none';
          ctx.drawImage(cutout, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        bg.src = backgroundSrc;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(cutout, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      }
    };
    cutout.src = cutoutSrc;
  });
}

async function ptRemoveBg(){
  if(!pt.original || pt.processing) return;
  pt.processing = true;
  ptUpdateUI();
  try {
    const compressed = await compressImage(pt.original, 1500, 0.88);
    const base64 = compressed.replace(/^data:image\/\w+;base64,/, '');
    const res = await fetch('/api/remove-bg', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 })
    });
    const data = await res.json();
    if(!res.ok || data.error) throw new Error(data.error || 'Failed to remove background.');
    pt.cutout = data.imageBase64;
    pt.bgMode = 'blur';
    pt.current = await compositeImage(pt.cutout, pt.original, 'blur');
  } catch(err){
    alert('Background removal failed: ' + err.message);
  } finally {
    pt.processing = false;
    ptUpdateUI();
  }
}

async function ptSwitchBg(mode){
  if(!pt.cutout) return;
  if(mode === 'showroom' && !backdrop){
    document.getElementById('pt-backdrop-input').click();
    return;
  }
  pt.bgMode = mode;
  const bgSrc = mode === 'showroom' ? backdrop : pt.original;
  pt.current = await compositeImage(pt.cutout, bgSrc, mode);
  ptUpdateUI();
}

// ── Product cards ─────────────────────────────────────────────
function render(){
  const n = items.filter(i=>i.approved).length;
  const total = items.length;
  document.getElementById('status-text').textContent = total === 0
    ? 'No items yet — paste a transcript below to get started'
    : n + ' of ' + total + ' items approved';
  document.getElementById('progress-fill').style.width = total > 0 ? (n/total*100)+'%' : '0%';

  const grid = document.getElementById('grid');
  if(total === 0){
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><strong>No items yet</strong><p>Paste a transcript above and click Process to generate listings automatically.</p></div>';
    return;
  }

  grid.innerHTML = items.map(item => {
    return '<div class="card' + (item.approved?' approved':'') + '">'
      + '<div class="card-body">'
      + (item.flag ? '<div class="flag">'+esc(item.flag)+'</div>' : '')
      + '<div class="card-top"><div><div class="card-title">'+esc(item.title)+'</div><div class="card-code">'+esc(item.code)+'</div></div><div class="badge">'+esc(item.category)+'</div></div>'
      + '<div class="card-desc">'+esc(item.description)+'</div>'
      + '<div class="prices">'
      + (item.single
          ? '<div class="price-box"><div class="price-label">Restored &amp; Waxed</div><div class="price-val">£'+item.priceRestored+'</div></div>'
          : '<div class="price-box"><div class="price-label">Current Condition</div><div class="price-val">£'+item.priceCurrent+'</div></div>'
            +'<div class="price-box"><div class="price-label">Restored &amp; Waxed</div><div class="price-val">£'+item.priceRestored+'</div></div>')
      + '</div>'
      + '<div class="dims">'
      + '<div class="dim-item"><span class="dim-label">H </span>'+esc(item.height)+'</div>'
      + '<div class="dim-item"><span class="dim-label">W </span>'+esc(item.width)+'</div>'
      + '<div class="dim-item"><span class="dim-label">D </span>'+esc(item.depth)+'</div>'
      + '</div>'
      + (item.extra ? '<div class="extra-note">'+esc(item.extra)+'</div>' : '')
      + '<div class="card-actions">'
      + '<button class="btn-edit" onclick="openEdit('+item.id+')">✏ Edit</button>'
      + '<button class="btn-preview" onclick="openPreview('+item.id+')">👁 Preview</button>'
      + '<button class="btn-approve'+(item.approved?' ok':'')+'" onclick="toggleApprove('+item.id+')">'+(item.approved?'✓ Done':'Approve')+'</button>'
      + '<button class="btn-delete" onclick="deleteItem('+item.id+')" title="Delete">🗑</button>'
      + '</div>'
      + '</div></div>';
  }).join('');
}

function toggleApprove(id){ const i=items.find(x=>x.id===id); i.approved=!i.approved; render(); }
function deleteItem(id){ if(!confirm('Delete this item?')) return; items=items.filter(i=>i.id!==id); render(); }
function clearAll(){ if(!items.length) return; if(!confirm('Clear all '+items.length+' items?')) return; items=[]; render(); }

function openPreview(id){
  const item = items.find(i=>i.id===id);
  document.getElementById('preview-modal').innerHTML =
    '<h2>'+esc(buildFullTitle(item))+'</h2>'
    +'<p class="preview-subtitle">How this listing will appear on the website</p>'
    +'<div class="preview-box">'+esc(buildFullDescription(item))+'</div>'
    +'<div class="preview-meta">'
    +'<p><strong>Title:</strong> '+esc(buildFullTitle(item))+'</p>'
    +'<p><strong>Tags / SKU:</strong> '+esc(item.code)+'</p>'
    +'<p><strong>Category page:</strong> '+esc(item.category)+'</p>'
    +'</div>'
    +'<div class="modal-btns" style="margin-top:16px">'
    +'<button class="btn-cancel" onclick="closeOverlay(\'preview-overlay\')">Close</button>'
    +'<button class="btn-save" onclick="closeOverlay(\'preview-overlay\');openEdit('+id+')">Edit Item</button>'
    +'</div>';
  document.getElementById('preview-overlay').style.display='flex';
}

function openEdit(id){
  editId = id;
  const item = items.find(i=>i.id===id);
  const catOpts = CATS.map(c=>'<option value="'+esc(c)+'"'+(c===item.category?' selected':'')+'>'+esc(c)+'</option>').join('');
  document.getElementById('edit-modal').innerHTML =
    '<h2>Edit Item</h2>'
    +'<div class="field"><label>Title</label><input id="e-title" value="'+esc(item.title)+'"></div>'
    +'<div class="row2"><div class="field"><label>Stock Code</label><input id="e-code" value="'+esc(item.code)+'"></div><div class="field"><label>Category</label><select id="e-cat">'+catOpts+'</select></div></div>'
    +'<div class="field"><label>Description</label><textarea id="e-desc" rows="6">'+esc(item.description)+'</textarea></div>'
    +'<div class="section-divider">Pricing</div>'
    +'<label class="check-label"><input type="checkbox" id="e-single" '+(item.single?'checked':'')+' onchange="toggleSingle(this)"> Single price only — already restored and waxed</label>'
    +'<div class="row2"><div class="field"><label>Current Condition (£)</label><input id="e-p1" type="number" value="'+item.priceCurrent+'" '+(item.single?'disabled style="opacity:0.4"':'')+'></div><div class="field"><label>Restored &amp; Waxed (£)</label><input id="e-p2" type="number" value="'+item.priceRestored+'"></div></div>'
    +'<div class="section-divider">Dimensions</div>'
    +'<div class="row3"><div class="field"><label>Height</label><input id="e-h" value="'+esc(item.height)+'"></div><div class="field"><label>Width</label><input id="e-w" value="'+esc(item.width)+'"></div><div class="field"><label>Depth</label><input id="e-d" value="'+esc(item.depth)+'"></div></div>'
    +'<div class="field" style="margin-top:10px"><label>Extra measurements / notes</label><input id="e-extra" value="'+esc(item.extra)+'"></div>'
    +'<div class="modal-btns" style="margin-top:16px"><button class="btn-cancel" onclick="closeOverlay(\'edit-overlay\')">Cancel</button><button class="btn-save" onclick="saveEdit()">Save Changes</button></div>';
  document.getElementById('edit-overlay').style.display='flex';
}

function toggleSingle(cb){ const p1=document.getElementById('e-p1'); p1.disabled=cb.checked; p1.style.opacity=cb.checked?'0.4':'1'; }
function closeOverlay(id){ document.getElementById(id).style.display='none'; if(id==='edit-overlay') editId=null; }
function overlayClick(e,id){ if(e.target===document.getElementById(id)) closeOverlay(id); }

function saveEdit(){
  const item = items.find(i=>i.id===editId); if(!item) return;
  item.title       = document.getElementById('e-title').value;
  item.code        = document.getElementById('e-code').value;
  item.category    = document.getElementById('e-cat').value;
  item.description = document.getElementById('e-desc').value;
  item.priceCurrent  = parseFloat(document.getElementById('e-p1').value)||0;
  item.priceRestored = parseFloat(document.getElementById('e-p2').value)||0;
  item.single      = document.getElementById('e-single').checked;
  item.height      = document.getElementById('e-h').value;
  item.width       = document.getElementById('e-w').value;
  item.depth       = document.getElementById('e-d').value;
  item.extra       = document.getElementById('e-extra').value;
  item.flag        = null;
  closeOverlay('edit-overlay');
  render();
}

function exportCSV(){
  if(!items.length){ alert('No items to export.'); return; }
  const headers = ['Product ID [Non Editable]','Variant ID [Non Editable]','Product Type [Non Editable]','Product Page','Product URL','Title','Description','SKU','GTIN','MPN','Option Name 1','Option Value 1','Option Name 2','Option Value 2','Option Name 3','Option Value 3','Option Name 4','Option Value 4','Option Name 5','Option Value 5','Option Name 6','Option Value 6','Price','Sale Price','On Sale','Stock','Categories','Tags','Weight','Length','Width','Height','Visible','Hosted Image URLs'];
  const rows = [];
  items.forEach(item => {
    const title = buildFullTitle(item);
    const slug  = toSlug(item.title+' '+item.code);
    const page  = CAT_PAGES[item.category]||'';
    const desc  = buildHtmlDescription(item);
    if(item.single){
      rows.push(['','','PHYSICAL',page,slug,title,desc,item.code,'','','','','','','','','','','','','','',item.priceRestored.toFixed(2),'0.00','No','1','',item.code,'0.0','0.0','0.0','0.0','No','']);
    } else {
      rows.push(['','','PHYSICAL',page,slug,title,desc,item.code,'','','Finish','Current condition','','','','','','','','','','',item.priceCurrent.toFixed(2),'0.00','No','1','',item.code,'0.0','0.0','0.0','0.0','No','']);
      rows.push(['','','','','','','',item.code+'-W','','','Finish','Restored and waxed','','','','','','','','','','',item.priceRestored.toFixed(2),'0.00','No','1','','','0.0','0.0','0.0','0.0','','']);
    }
  });
  const csv = [headers,...rows].map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'pinefinders_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

render();

// ── Photo Tool event wiring ───────────────────────────────────
(function(){
  // File inputs — addEventListener as backup to inline onchange
  const fi = document.getElementById('pt-file-input');
  const fic = document.getElementById('pt-file-input-change');
  if(fi)  fi.addEventListener('change',  function(){ ptLoadPhoto(this); });
  if(fic) fic.addEventListener('change', function(){ ptLoadPhoto(this); });

  // Backdrop (showroom background) upload
  const backdropInput = document.getElementById('pt-backdrop-input');
  if(backdropInput){
    backdropInput.addEventListener('change', function(){
      const file = this.files[0]; if(!file) return;
      backdropName = file.name.replace(/\.[^.]+$/, '') || 'backdrop';
      const r = new FileReader();
      r.onload = async e => {
        backdrop = e.target.result;
        if(pt.cutout){
          pt.bgMode = 'showroom';
          pt.current = await compositeImage(pt.cutout, backdrop, 'showroom');
          ptUpdateUI();
        }
      };
      r.readAsDataURL(file);
    });
  }

  // Drag-and-drop on upload area
  const uploadArea = document.getElementById('pt-upload-area');
  if(!uploadArea) return;
  uploadArea.addEventListener('dragover', function(e){
    e.preventDefault(); e.stopPropagation();
    uploadArea.style.background = '#f0ebe5';
    uploadArea.style.borderColor = '#8a5d3b';
  });
  uploadArea.addEventListener('dragleave', function(e){
    e.preventDefault(); e.stopPropagation();
    uploadArea.style.background = '';
    uploadArea.style.borderColor = '';
  });
  uploadArea.addEventListener('drop', function(e){
    e.preventDefault(); e.stopPropagation();
    uploadArea.style.background = '';
    uploadArea.style.borderColor = '';
    const files = e.dataTransfer.files;
    if(files && files[0]) ptLoadPhoto({ files: files });
  });
})();
