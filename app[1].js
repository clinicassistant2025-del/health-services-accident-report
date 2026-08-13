const { createClient } = supabase;
const cfg = window.APP_CONFIG || {};
const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

const $ = id => document.getElementById(id);
const state = { user:null, profile:null, records:[], editing:null };

const COMPANY_CONFIG = {
  CGSI: { name:"Cebu Global Steel Industries, Inc.", short:"CGSI", doc:"HRA-CLC-RPT-01", logo:"assets/logo-mvbi.png" },
  CLMC: { name:"CLMC", short:"CLMC", doc:"HRA-CLC-RPT-01", logo:"assets/logo-mvbi.png" },
  VFI:  { name:"Virginia Food, Inc.", short:"VFI", doc:"HRA-CLC-RPT-01", logo:"assets/logo-mvbi.png" },
  MVBI: { name:"Malachite Value Builders, Inc.", short:"MVBI", doc:"HRA-CLC-RPT-01", logo:"assets/logo-mvbi.png" }
};

document.addEventListener("DOMContentLoaded", async () => {
  fillReportYears();
  setDefaultDateTimes();
  bindEvents();
  await restoreSession();
});

function bindEvents(){
  $("loginForm").addEventListener("submit", login);
  $("logoutBtn").addEventListener("click", logout);
  $("newBtn").addEventListener("click", () => showForm());
  $("cancelBtn").addEventListener("click", hideForm);
  $("cancelBtn2").addEventListener("click", hideForm);
  $("accidentForm").addEventListener("submit", saveRecord);
  $("picture").addEventListener("change", previewPicture);
  $("searchInput").addEventListener("input", renderRecords);
  $("reportBtn").addEventListener("click", openReportControls);
  $("closeReportBtn").addEventListener("click", () => $("reportSection").classList.add("hidden"));
  $("generateReportBtn").addEventListener("click", generateReport);
}

async function restoreSession(){
  const { data } = await sb.auth.getSession();
  if(data.session){
    state.user = data.session.user;
    await loadProfileAndEnter();
  }
}

async function login(e){
  e.preventDefault();
  if(!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT")){
    toast("Open config.js and add your Supabase URL and publishable/anon key.", true);
    return;
  }
  const company = $("loginCompany").value;
  const username = $("loginUsername").value.trim().toLowerCase();
  const password = $("loginPassword").value;
  if(!company || !username || !password) return toast("Please complete all login fields.", true);

  const email = makeLoginEmail(username, company);
  const { data, error } = await sb.auth.signInWithPassword({email, password});
  if(error){ toast(error.message, true); return; }
  state.user = data.user;
  await loadProfileAndEnter(company);
}

function makeLoginEmail(username, company){
  return `${username}@${company.toLowerCase()}.healthservices.local`;
}

async function loadProfileAndEnter(selectedCompany){
  const { data: profile, error } = await sb.from("profiles")
    .select("id,username,company,role,full_name")
    .eq("id", state.user.id).single();

  if(error || !profile){
    await sb.auth.signOut();
    toast("Your account does not have a Health Services profile. Ask the administrator to create one.", true);
    return;
  }
  if(selectedCompany && profile.company !== selectedCompany){
    await sb.auth.signOut();
    toast("The selected company does not match your account.", true);
    return;
  }
  state.profile = profile;
  $("loginView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("companyHeading").textContent = `${profile.company} — Dashboard`;
  $("userBadge").textContent = `${profile.company} • ${profile.username}`;
  await loadRecords();
}

async function logout(){
  await sb.auth.signOut();
  state.user = null; state.profile = null; state.records = [];
  $("appView").classList.add("hidden");
  $("loginView").classList.remove("hidden");
  $("loginPassword").value = "";
}

async function loadRecords(){
  if(!state.profile) return;
  const { data, error } = await sb.from("accidents")
    .select("*")
    .order("accident_at", {ascending:false});
  if(error){ toast(error.message, true); return; }
  state.records = data || [];
  renderRecords();
  updateStats();
}

function renderRecords(){
  const q = $("searchInput").value.trim().toLowerCase();
  const rows = state.records.filter(r => {
    if(!q) return true;
    return [r.employee_name,r.department,r.place_of_accident,r.nature_history,r.intervention,r.fit_to_work]
      .some(v => String(v||"").toLowerCase().includes(q));
  });
  $("recordsBody").innerHTML = rows.map((r,i) => `
    <tr>
      <td>${escapeHtml(r.report_no || "")}</td>
      <td>${formatDateTime(r.accident_at)}</td>
      <td>${escapeHtml(r.employee_name)}</td>
      <td>${escapeHtml(r.department)}</td>
      <td>${escapeHtml(r.place_of_accident)}</td>
      <td>${escapeHtml(r.fit_to_work)}</td>
      <td>${r.picture_path ? `<span class="muted">Photo saved</span>` : "—"}</td>
      <td>
        <button class="small-btn" onclick="editRecord('${r.id}')">EDIT</button>
        <button class="small-btn" onclick="deleteRecord('${r.id}')">DELETE</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="8" style="text-align:center;padding:30px">No records found.</td></tr>`;
}

function updateStats(){
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const month = state.records.filter(r => {
    const d = new Date(r.accident_at); return d.getFullYear()===y && d.getMonth()===m;
  });
  $("statTotal").textContent = state.records.length;
  $("statMonth").textContent = month.length;
  $("statFit").textContent = state.records.filter(r=>r.fit_to_work==="FIT").length;
  $("statFollow").textContent = state.records.filter(r=>r.fit_to_work==="FOR FOLLOW-UP").length;
  $("statUnfit").textContent = state.records.filter(r=>r.fit_to_work==="UNFIT").length;
}

function showForm(record=null){
  state.editing = record;
  $("formTitle").textContent = record ? "Edit Accident Report" : "New Accident Report";
  $("recordId").value = record?.id || "";
  $("accidentAt").value = toLocalInput(record?.accident_at) || toLocalInput(new Date().toISOString());
  $("reportedAt").value = toLocalInput(record?.reported_at) || toLocalInput(new Date().toISOString());
  $("place").value = record?.place_of_accident || "";
  $("employeeName").value = record?.employee_name || "";
  $("age").value = record?.age ?? "";
  $("sex").value = record?.sex || "";
  $("department").value = record?.department || "";
  $("natureHistory").value = record?.nature_history || "";
  $("intervention").value = record?.intervention || "";
  $("fitToWork").value = record?.fit_to_work || "";
  $("picture").value = "";
  $("currentPicture").textContent = record?.picture_path ? "Existing picture saved. Choose a new file only if replacing it." : "";
  $("picturePreviewWrap").classList.add("hidden");
  $("dashboardSection").classList.add("hidden");
  $("reportSection").classList.add("hidden");
  $("formSection").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

function hideForm(){
  state.editing = null;
  $("formSection").classList.add("hidden");
  $("dashboardSection").classList.remove("hidden");
}

async function saveRecord(e){
  e.preventDefault();
  $("saveBtn").disabled = true;
  try{
    const payload = {
      accident_at: new Date($("accidentAt").value).toISOString(),
      place_of_accident: $("place").value.trim(),
      reported_at: new Date($("reportedAt").value).toISOString(),
      employee_name: $("employeeName").value.trim(),
      age: Number($("age").value),
      sex: $("sex").value,
      department: $("department").value.trim(),
      nature_history: $("natureHistory").value.trim(),
      intervention: $("intervention").value.trim(),
      fit_to_work: $("fitToWork").value
    };

    const file = $("picture").files[0];
    let row;
    if(state.editing){
      const { data, error } = await sb.from("accidents").update(payload).eq("id",state.editing.id).select().single();
      if(error) throw error;
      row = data;
    }else{
      payload.company = state.profile.company;
      payload.created_by = state.user.id;
      const { data, error } = await sb.from("accidents").insert(payload).select().single();
      if(error) throw error;
      row = data;
    }

    if(file){
      if(file.size > 8*1024*1024) throw new Error("Picture must be 8 MB or smaller.");
      if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Only JPG, PNG or WEBP pictures are allowed.");
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `${state.profile.company}/${row.id}.${ext}`;
      const { error: uploadError } = await sb.storage.from("accident-pictures").upload(path,file,{upsert:true,contentType:file.type});
      if(uploadError) throw uploadError;
      const { error: updateError } = await sb.from("accidents").update({picture_path:path}).eq("id",row.id);
      if(updateError) throw updateError;
    }

    toast(state.editing ? "Accident report updated." : `Accident report saved: ${row.report_no}`);
    hideForm();
    await loadRecords();
  }catch(err){
    toast(err.message || "Unable to save report.", true);
  }finally{
    $("saveBtn").disabled = false;
  }
}

window.editRecord = async function(id){
  const record = state.records.find(r=>r.id===id);
  if(record) showForm(record);
};

window.deleteRecord = async function(id){
  const record = state.records.find(r=>r.id===id);
  if(!record) return;
  if(!confirm(`Delete accident report ${record.report_no}? This cannot be undone.`)) return;
  const { error } = await sb.from("accidents").delete().eq("id",id);
  if(error){ toast(error.message,true); return; }
  toast("Record deleted.");
  await loadRecords();
};

function previewPicture(){
  const file = $("picture").files[0];
  if(!file){ $("picturePreviewWrap").classList.add("hidden"); return; }
  const url = URL.createObjectURL(file);
  $("picturePreview").src = url;
  $("picturePreviewWrap").classList.remove("hidden");
}

function openReportControls(){
  $("formSection").classList.add("hidden");
  $("dashboardSection").classList.add("hidden");
  $("reportSection").classList.remove("hidden");
  const now = new Date();
  $("reportMonth").value = String(now.getMonth());
  $("reportYear").value = String(now.getFullYear());
  $("reportPreview").classList.add("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}

function fillReportYears(){
  const now = new Date().getFullYear();
  const y = $("reportYear");
  for(let i=now-5;i<=now+1;i++){
    const o=document.createElement("option");o.value=i;o.textContent=i;y.appendChild(o);
  }
  const months=["January","February","March","April","May","June","July","August","September","October","November","December"];
  $("reportMonth").innerHTML=months.map((m,i)=>`<option value="${i}">${m}</option>`).join("");
}

async function generateReport(){
  const month = Number($("reportMonth").value);
  const year = Number($("reportYear").value);
  const records = state.records.filter(r=>{
    const d=new Date(r.accident_at);
    return d.getFullYear()===year && d.getMonth()===month;
  }).sort((a,b)=>new Date(a.accident_at)-new Date(b.accident_at));

  const html = await buildReportHtml(records,month,year);
  $("reportPreview").innerHTML = html;
  $("reportPreview").classList.remove("hidden");

  const printRoot = document.createElement("div");
  printRoot.id="reportPrintRoot";
  printRoot.innerHTML=html;
  printRoot.style.display="none";
  document.body.appendChild(printRoot);
  setTimeout(()=>{
    printRoot.style.display="block";
    window.print();
    setTimeout(()=>printRoot.remove(),500);
  },150);
}

async function buildReportHtml(records,month,year){
  const company=state.profile.company;
  const cfg=COMPANY_CONFIG[company]||{name:company,short:company,doc:"HRA-CLC-RPT-01",logo:"assets/logo-mvbi.png"};
  const logo=cfg.logo;

  const photoUrls={};
  for(const r of records){
    if(r.picture_path){
      const {data}=await sb.storage.from("accident-pictures").createSignedUrl(r.picture_path,600);
      if(data?.signedUrl) photoUrls[r.id]=data.signedUrl;
    }
  }

  const male=records.filter(r=>r.sex==="Male").length;
  const female=records.filter(r=>r.sex==="Female").length;
  const total=records.length;
  const monthName=new Date(year,month,1).toLocaleString("en-US",{month:"long"}).toUpperCase();

  const rows=records.length ? records.map((r,i)=>`
    <tr>
      <td class="no">${i+1}</td>
      <td class="accdt">${formatReportDate(r.accident_at)}</td>
      <td class="place">${escapeHtml(r.place_of_accident)}</td>
      <td class="repdt">${formatReportDate(r.reported_at)}</td>
      <td class="name">${escapeHtml(r.employee_name)}</td>
      <td class="age">${r.age}</td>
      <td class="sex">${escapeHtml(r.sex==="Male"?"M":"F")}</td>
      <td class="dept">${escapeHtml(r.department)}</td>
      <td class="nature">${escapeHtml(r.nature_history)}</td>
      <td class="intervention">${escapeHtml(r.intervention)}</td>
      <td class="fit">${escapeHtml(r.fit_to_work)}</td>
      <td class="picture">${photoUrls[r.id]?`<img class="photo" src="${photoUrls[r.id]}" alt="Accident picture">`:""}</td>
    </tr>
  `).join("") : `<tr><td colspan="12" style="text-align:center;padding:30px">NO ACCIDENT RECORDS FOR ${monthName} ${year}</td></tr>`;

  return `
  <div class="report-page">
    <div class="report-head">
      <div class="report-logo"><img src="${logo}" alt="Company logo"></div>
      <div class="report-company">
        <div><strong>${escapeHtml(cfg.name)}</strong></div>
        <div>Health Services Section</div>
        <div class="report-title">MONTHLY ACCIDENT REPORT</div>
        <div class="report-section">HEALTH SERVICES SECTION</div>
        <div><strong>MONTH OF: ${monthName} ${year}</strong></div>
      </div>
      <div class="report-meta">
        <div>Revision No. 01</div>
        <div>Document No.: ${escapeHtml(cfg.doc)}</div>
        <div>Revision Date: 3 January 2022</div>
        <div>Effectivity Date: 3 January 2022</div>
      </div>
    </div>

    <table class="report-table">
      <thead><tr>
        <th class="no">NO.</th>
        <th class="accdt">DATE & TIME<br>OF ACCIDENT</th>
        <th class="place">PLACE OF<br>ACCIDENT</th>
        <th class="repdt">DATE & TIME<br>REPORTED</th>
        <th class="name">NAME OF EMPLOYEE</th>
        <th class="age">AGE</th>
        <th class="sex">SEX</th>
        <th class="dept">DEPARTMENT</th>
        <th class="nature">NATURE AND<br>HISTORY OF ACCIDENT</th>
        <th class="intervention">INTERVENTION</th>
        <th class="fit">FIT-TO-WORK</th>
        <th class="picture">PICTURE</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <table class="report-summary">
      <tr><td>Male</td><td>${male}</td></tr>
      <tr><td>Female</td><td>${female}</td></tr>
      <tr><td><strong>Total:</strong></td><td><strong>${total}</strong></td></tr>
    </table>

    <div class="signatures">
      <div class="signature-cell"><div>Prepared by/Date:</div><div class="line">MAE ANNE B. TRILLANA, RN</div><div class="role">Health Program Coordinator / Occupational Health Nurse</div></div>
      <div class="signature-cell"><div>Reviewed by/Date:</div><div class="line">DR. MARICEL SANICO - EDNILAN</div><div class="role">Occupational Health Physician</div></div>
      <div class="signature-cell"><div>Received by/Date:</div><div class="line">SYDNEY L. BEDUYA</div><div class="role">Officer, Safety Officer</div></div>
    </div>

    <div class="report-footer">
      <div>Reproduction, photocopying, storage or transmission by magnetic or electronic means is strictly prohibited by law. Neither the document nor the information contained therein may be reproduced or transmitted without authorization.</div>
      <div>This document is referred to as: <strong>Monthly Accident Report</strong></div>
    </div>
  </div>`;
}

function setDefaultDateTimes(){
  const now = new Date();
  const local=toLocalInput(now.toISOString());
  $("accidentAt").value=local;
  $("reportedAt").value=local;
}

function toLocalInput(iso){
  if(!iso) return "";
  const d=new Date(iso);
  const pad=n=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateTime(iso){
  if(!iso) return "";
  return new Date(iso).toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).replace(",","");
}
function formatReportDate(iso){
  if(!iso) return "";
  const d=new Date(iso);
  const mon=d.toLocaleString("en-US",{month:"short"}).toUpperCase();
  const pad=n=>String(n).padStart(2,"0");
  return `${pad(d.getDate())}${mon}${d.getFullYear()} ${pad(d.getHours())}${pad(d.getMinutes())}H`;
}
function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function toast(msg,error=false){
  const t=$("toast");t.textContent=msg;t.className=`toast show${error?" error":""}`;
  clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>t.className="toast",3500);
}
