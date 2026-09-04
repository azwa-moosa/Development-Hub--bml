/*
  BML Development Hub - static functional prototype
  --------------------------------------------------
  Production note:
  - Replace APP_CONTEXT.currentUser with the authenticated Microsoft Entra / app user.
  - Populate currentUser.roles from your role mapping / security group mapping.
  - The role switcher below ONLY switches between already-assigned roles; it never grants access.
  - Replace sendBatchNotification() with Power Automate / Graph / backend API when connected.
*/

const KEY = "bml-development-hub-v4";
const TARGET_SLOTS = 5;

const APP_CONTEXT = {
  currentUser: {
    id: "demo-user",
    uid: "DEMO",
    name: "Demo User",
    email: "demo.user@bankofmaldives.com.mv",
    // Demo shows all permitted screens. In production these come from the signed-in user's assigned roles.
    roles: ["STAFF", "PROVIDER", "HR_ADMIN"],
    providerId: null
  }
};

const seed = {
  settings: {
    appName: "Development Hub",
    slotTarget: TARGET_SLOTS
  },
  programmes: [
    {
      id: "FLASH_MENTORING",
      name: "Flash Mentoring",
      description: "Focused one-to-one guidance, knowledge sharing and career conversations.",
      mode: "BOOKABLE",
      enabled: true,
      icon: "↗"
    },
    {
      id: "COACHING",
      name: "Coaching",
      description: "Structured coaching support around leadership, performance and professional development.",
      mode: "BOOKABLE",
      enabled: true,
      icon: "◇"
    },
    {
      id: "GROWTH_MENTORSHIP",
      name: "Growth Mentorship",
      description: "HR-managed development cohorts, participant batches, meetings and programme follow-up.",
      mode: "BATCH",
      enabled: true,
      icon: "◎"
    }
  ],
  providerTypes: [
    { id: "pt-flash", name: "Flash Mentor", programmeId: "FLASH_MENTORING", active: true },
    { id: "pt-icf", name: "ICF Coach", programmeId: "COACHING", active: true },
    { id: "pt-growth", name: "Growth Mentor", programmeId: "GROWTH_MENTORSHIP", active: true }
  ],

  // Intentionally empty: HR Admin owns and maintains these. Nothing is hard-coded.
  categories: [],
  expertise: [],
  providers: [],
  slots: [],
  bookings: [],
  growthBatches: [],
  feedback: [],
  auditTrail: []
};

const deepCopy = (value) => JSON.parse(JSON.stringify(value));
const currentUser = APP_CONTEXT.currentUser;
let state = load();
let role = resolveInitialRole();
let view = "overview";
let selectedSlot = null;
let expandedProviders = new Set();
let sessionTab = "REQUESTED";
let photoDraft = "";
let auditSearch = "";
let filters = {
  programme: "",
  category: "",
  expertise: "",
  search: ""
};

function load(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return deepCopy(seed);
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  }catch(err){
    console.warn("Could not load prototype data", err);
    return deepCopy(seed);
  }
}

function normalizeState(value){
  const base = deepCopy(seed);
  return {
    ...base,
    ...value,
    settings: { ...base.settings, ...(value.settings || {}) },
    programmes: Array.isArray(value.programmes) ? value.programmes : base.programmes,
    providerTypes: Array.isArray(value.providerTypes) ? value.providerTypes : base.providerTypes,
    categories: Array.isArray(value.categories) ? value.categories : [],
    expertise: Array.isArray(value.expertise) ? value.expertise : [],
    providers: Array.isArray(value.providers) ? value.providers : [],
    slots: Array.isArray(value.slots) ? value.slots : [],
    bookings: Array.isArray(value.bookings) ? value.bookings : [],
    growthBatches: Array.isArray(value.growthBatches) ? value.growthBatches : [],
    feedback: Array.isArray(value.feedback) ? value.feedback : [],
    auditTrail: Array.isArray(value.auditTrail) ? value.auditTrail : []
  };
}

function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
}

function resetPrototype(){
  if(!confirm("Reset the prototype and remove all HR-maintained data?")) return;
  state = deepCopy(seed);
  selectedSlot = null;
  expandedProviders.clear();
  save();
  toast("Prototype data reset");
  render();
}

function resolveInitialRole(){
  const allowed = currentUser.roles || [];
  if(allowed.includes("STAFF")) return "STAFF";
  return allowed[0] || "STAFF";
}

function hasRole(nextRole){
  return (currentUser.roles || []).includes(nextRole);
}

function setRole(nextRole){
  if(!hasRole(nextRole)){
    toast("You are not assigned to that role");
    return;
  }
  role = nextRole;
  view = "overview";
  selectedSlot = null;
  render();
}

function go(nextView){
  view = nextView;
  selectedSlot = null;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function id(prefix){
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
}

function esc(value=""){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function xmlEsc(value=""){
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function programme(idValue){ return state.programmes.find(x => x.id === idValue); }
function provider(idValue){ return state.providers.find(x => x.id === idValue); }
function providerType(idValue){ return state.providerTypes.find(x => x.id === idValue); }
function category(idValue){ return state.categories.find(x => x.id === idValue); }
function expertise(idValue){ return state.expertise.find(x => x.id === idValue); }
function growthBatch(idValue){ return state.growthBatches.find(x => x.id === idValue); }

function enabledProgrammes(mode=""){
  return state.programmes.filter(p => p.enabled && (!mode || p.mode === mode));
}

function myProvider(){
  return state.providers.find(p =>
    p.active && (
      (currentUser.providerId && p.id === currentUser.providerId) ||
      (p.userId && p.userId === currentUser.id) ||
      (p.email && currentUser.email && p.email.toLowerCase() === currentUser.email.toLowerCase())
    )
  );
}

function initials(name=""){
  return name.split(/\s+/).filter(Boolean).map(x => x[0]).slice(0,2).join("").toUpperCase() || "?";
}

function dateFmt(value){
  if(!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

function shortDate(value){
  if(!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
}

function timestampFmt(value){
  if(!value) return "—";
  return new Date(value).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function toast(message){
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

function closeModal(){
  document.getElementById("modal")?.remove();
}

function statusBadge(status){
  return `<span class="badge badge-${esc(status)}">${esc(status)}</span>`;
}

function addAudit(action, entityType, entityId, detail=""){
  state.auditTrail.unshift({
    id: id("audit"),
    timestamp: new Date().toISOString(),
    actorId: currentUser.id,
    actorName: currentUser.name,
    role,
    action,
    entityType,
    entityId: entityId || "",
    detail
  });
  if(state.auditTrail.length > 1500) state.auditTrail.length = 1500;
}

function stat(title, value, sub=""){
  return `<div class="stat"><div class="stat-label">${esc(title)}</div><div class="stat-value">${esc(value)}</div>${sub ? `<div class="helper">${esc(sub)}</div>` : ""}</div>`;
}

function heading(eyebrow, title, desc, actions=""){
  return `<section class="page-heading">
    <div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>
    ${actions ? `<div class="heading-actions">${actions}</div>` : ""}
  </section>`;
}

function roleName(value){
  return value === "HR_ADMIN" ? "HR Admin" : value === "PROVIDER" ? "Provider" : "Staff";
}

function roleSwitch(){
  const roles = currentUser.roles || [];
  if(roles.length <= 1) return "";
  return `<div class="role-switch" title="Only roles already assigned to the signed-in user appear here">
    ${roles.map(r => `<button class="${role === r ? "active" : ""}" onclick="setRole('${r}')">${esc(roleName(r))}</button>`).join("")}
  </div>`;
}

function sidebar(){
  const growthOn = programme("GROWTH_MENTORSHIP")?.enabled;
  const staffNav = [
    ["overview","⌂","Overview"],
    ["find","⌕","Find Support"],
    ["sessions","◷","My Sessions"],
    ...(growthOn ? [["growth","◎","Growth Mentorship"]] : [])
  ];

  const providerNav = [
    ["overview","⌂","Overview"],
    ["requests","✉","Requests"],
    ["availability","◫","Availability"],
    ["profile","♙","My Profile"]
  ];

  const hrNav = [
    ["overview","⌂","Dashboard"],
    ["programmes","⚙","Programmes"],
    ["providers","♙","Provider Directory"],
    ["growth","◎","Growth Mentorship"],
    ["bookings","◷","Bookings"],
    ["availability","◫","Availability"],
    ["categories","▦","Categories & Expertise"],
    ["audit","≡","Audit Trail"]
  ];

  const config = role === "HR_ADMIN" ? hrNav : role === "PROVIDER" ? providerNav : staffNav;

  return `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">B</div><div class="brand-copy"><strong>BML Development Hub</strong><span>People & Culture</span></div></div>
    <div class="sidebar-role">${esc(roleName(role))}</div>
    <nav class="nav">
      ${config.map(([v,ic,label]) => `<button class="${view === v ? "active" : ""}" onclick="go('${v}')"><span>${ic}</span>${esc(label)}</button>`).join("")}
    </nav>
    <div class="sidebar-bottom"><small>Role access is controlled by the signed-in user. HR configuration is audit logged.</small></div>
  </aside>`;
}

function topbar(){
  return `<header class="topbar">
    <div class="topbar-left">
      <div class="topbar-title"><span>${esc(roleName(role))}</span><strong>${esc(state.settings.appName)}</strong></div>
    </div>
    <div class="topbar-actions">
      ${roleSwitch()}
      <div class="topbar-profile"><div class="avatar">${initials(currentUser.name)}</div><div class="profile-copy"><strong>${esc(currentUser.name)}</strong><span>${esc(currentUser.uid || currentUser.email || "Signed in")}</span></div></div>
    </div>
  </header>`;
}

function shell(content){
  return `<div class="shell">${sidebar()}<div class="workspace">${topbar()}<main class="content">${content}</main></div></div>`;
}

function programmeCard(p, index=0){
  const styleClass = index % 3 === 1 ? "blue" : index % 3 === 2 ? "purple" : "";
  const action = p.mode === "BATCH" ? `go('growth')` : `chooseProgramme('${p.id}')`;
  return `<article class="service-card ${styleClass}" onclick="${action}">
    <div class="service-icon">${esc(p.icon || "◎")}</div>
    <div><div class="eyebrow">${esc(p.name)}</div><h2>${esc(p.name)}</h2><p>${esc(p.description || "Development support programme")}</p></div>
    <div class="service-link">${p.mode === "BATCH" ? "View programme →" : "Explore providers →"}</div>
  </article>`;
}

function chooseProgramme(programmeId){
  filters.programme = programmeId;
  filters.category = "";
  filters.expertise = "";
  filters.search = "";
  go("find");
}

/* ----------------------------- STAFF ----------------------------- */
function staffOverview(){
  const mine = state.bookings.filter(b => b.staffId === currentUser.id || (b.staffEmail && b.staffEmail.toLowerCase() === currentUser.email.toLowerCase()));
  const requested = mine.filter(b => b.status === "REQUESTED").length;
  const upcoming = mine.filter(b => b.status === "ACCEPTED").length;
  const completed = mine.filter(b => b.status === "COMPLETED").length;
  const programmes = enabledProgrammes();

  return shell(
    heading("My Development", "Welcome back", "Access the development programmes currently enabled by HR and keep track of your sessions.") +
    `<section class="stat-grid">${stat("Pending Requests", requested)}${stat("Upcoming Sessions", upcoming)}${stat("Completed", completed)}</section>
    ${programmes.length ? `<section class="service-grid">${programmes.map(programmeCard).join("")}</section>` : `<div class="empty"><strong>No programmes are currently enabled.</strong>HR can enable programmes from Programme Settings.</div>`}
    <section class="section"><div class="section-head"><div><h2>Upcoming sessions</h2><p>Your confirmed one-to-one sessions.</p></div><button class="btn btn-secondary btn-sm" onclick="go('sessions')">View all</button></div>
      ${mine.filter(b => b.status === "ACCEPTED").slice(0,2).map(b => sessionCard(b)).join("") || `<div class="empty">No upcoming sessions.</div>`}
    </section>`
  );
}

function staffFind(){
  const bookable = enabledProgrammes("BOOKABLE");
  if(!filters.programme || !bookable.some(p => p.id === filters.programme)){
    filters.programme = bookable[0]?.id || "";
  }

  const selectedProgramme = programme(filters.programme);
  const expertiseOptions = state.expertise.filter(e => !filters.category || e.categoryId === filters.category);

  let providers = state.providers.filter(p => p.active && p.programmeIds?.includes(filters.programme));
  if(filters.expertise) providers = providers.filter(p => p.expertiseIds?.includes(filters.expertise));
  if(filters.search){
    const q = filters.search.toLowerCase();
    providers = providers.filter(p => `${p.name} ${p.jobTitle} ${p.department} ${(p.providerTypeIds || []).map(x => providerType(x)?.name || "").join(" ")}`.toLowerCase().includes(q));
  }

  if(!bookable.length){
    return shell(heading("Find Support", "No bookable programmes available", "HR has not enabled a bookable programme yet.") + `<div class="empty">Please check again when a programme is enabled.</div>`);
  }

  return shell(
    heading("Find Support", selectedProgramme?.name || "Find Support", "Browse a compact provider directory. Open a profile only when you want to see details, expertise and available times.") +
    `<section class="filter-panel">
      <div class="field"><label>Programme</label><select onchange="setProgrammeFilter(this.value)">${bookable.map(p => `<option value="${esc(p.id)}" ${filters.programme === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Search</label><input value="${esc(filters.search)}" placeholder="Name, title or division" oninput="setProviderSearch(this.value)"></div>
      <div class="field"><label>Category <span class="optional">Optional</span></label><select onchange="setCategoryFilter(this.value)"><option value="">All categories</option>${state.categories.map(c => `<option value="${esc(c.id)}" ${filters.category === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Expertise <span class="optional">Optional</span></label><select onchange="setExpertiseFilter(this.value)"><option value="">All expertise</option>${expertiseOptions.map(e => `<option value="${esc(e.id)}" ${filters.expertise === e.id ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></div>
    </section>
    ${!state.categories.length ? `<div class="notice info">HR has not configured categories or expertise yet. You can still browse and book providers without them.</div>` : ""}
    <section class="section"><div class="section-head"><div><h2>Available providers</h2><p>${providers.length} profile${providers.length === 1 ? "" : "s"} available for ${esc(selectedProgramme?.name || "this programme")}.</p></div></div>
      ${providers.length ? `<div class="provider-grid">${providers.map(p => providerCard(p, false)).join("")}</div>` : `<div class="empty"><strong>No provider profiles are available yet.</strong>HR Admin can add and publish profiles from Provider Directory.</div>`}
    </section>
    ${selectedSlot ? requestPanel() : ""}`
  );
}

function setProgrammeFilter(value){ filters.programme = value; filters.category = ""; filters.expertise = ""; selectedSlot = null; render(); }
function setProviderSearch(value){ filters.search = value; selectedSlot = null; render(); }
function setCategoryFilter(value){ filters.category = value; filters.expertise = ""; selectedSlot = null; render(); }
function setExpertiseFilter(value){ filters.expertise = value; selectedSlot = null; render(); }

function providerPhoto(p, large=false){
  const cls = large ? "provider-photo" : "provider-photo";
  return `<div class="${cls}">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : initials(p.name)}</div>`;
}

function providerCard(p, adminMode=false){
  const expanded = expandedProviders.has(p.id);
  const types = (p.providerTypeIds || []).map(providerType).filter(Boolean);
  const progs = (p.programmeIds || []).map(programme).filter(Boolean);
  const ex = (p.expertiseIds || []).map(expertise).filter(Boolean);
  const openSlots = state.slots.filter(s => s.providerId === p.id && s.programmeId === filters.programme && s.status === "OPEN").sort((a,b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));

  return `<article class="provider-card">
    <div class="provider-summary">
      ${providerPhoto(p)}
      <div class="provider-copy"><h3>${esc(p.name)}</h3><p>${esc(p.jobTitle || "")}</p><small>${esc(p.department || "")}</small></div>
      ${adminMode ? statusBadge(p.active ? "ACTIVE" : "INACTIVE") : ""}
    </div>
    <div class="provider-quick">${types.slice(0,2).map(t => `<span class="tag red">${esc(t.name)}</span>`).join("")}${progs.slice(0,2).map(x => `<span class="tag">${esc(x.name)}</span>`).join("")}</div>
    <div class="provider-actions">
      <button class="btn btn-secondary btn-sm" onclick="toggleProviderDetails('${p.id}')">${expanded ? "Hide details" : "View profile"}</button>
      ${adminMode ? `<button class="btn btn-secondary btn-sm" onclick="providerModal('${p.id}')">Edit</button><button class="btn btn-ghost btn-sm" onclick="toggleProvider('${p.id}')">${p.active ? "Deactivate" : "Activate"}</button>` : ""}
    </div>
    ${expanded ? `<div class="provider-details">
      <p>${esc(p.about || "No profile summary added yet.")}</p>
      <div class="provider-meta"><div><span>Email</span><strong>${esc(p.email || "—")}</strong></div><div><span>UID</span><strong>${esc(p.uid || "—")}</strong></div></div>
      ${ex.length ? `<div class="tags">${ex.map(x => `<span class="tag blue">${esc(x.name)}</span>`).join("")}</div>` : `<div class="helper">No expertise tags added.</div>`}
      ${!adminMode && filters.programme ? `<div class="slots"><strong style="font-size:11px">Available times</strong>${openSlots.length ? `<div class="slot-grid">${openSlots.map(s => `<button class="slot ${selectedSlot === s.id ? "selected" : ""}" onclick="selectSlot('${s.id}')"><span>${shortDate(s.date)}</span><small>${esc(s.start)} – ${esc(s.end)}</small></button>`).join("")}</div>` : `<p class="helper" style="margin-top:8px">No open times published.</p>`}</div>` : ""}
    </div>` : ""}
  </article>`;
}

function toggleProviderDetails(providerId){
  if(expandedProviders.has(providerId)) expandedProviders.delete(providerId);
  else expandedProviders.add(providerId);
  render();
}

function selectSlot(slotId){
  selectedSlot = slotId;
  render();
  setTimeout(() => document.querySelector(".request-panel")?.scrollIntoView({ behavior:"smooth", block:"start" }), 50);
}

function requestPanel(){
  const slot = state.slots.find(s => s.id === selectedSlot && s.status === "OPEN");
  if(!slot) return "";
  const p = provider(slot.providerId);
  return `<section class="request-panel">
    <div class="eyebrow">Session Request</div><h2>${esc(programme(slot.programmeId)?.name || "Session")}</h2>
    <div class="notice info">Requesting ${esc(p?.name || "provider")} · ${dateFmt(slot.date)} · ${esc(slot.start)}–${esc(slot.end)}</div>
    <div class="form-grid">
      <div class="field"><label>Category <span class="optional">Optional</span></label><select id="request-category" onchange="requestCategoryChanged(this.value)"><option value="">Not specified</option>${state.categories.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Expertise <span class="optional">Optional</span></label><select id="request-expertise"><option value="">Not specified</option>${state.expertise.map(e => `<option value="${esc(e.id)}" data-category="${esc(e.categoryId)}">${esc(e.name)}</option>`).join("")}</select></div>
    </div>
    <div class="field" style="margin-top:13px"><label>What would you like to discuss?</label><textarea id="request-topic" placeholder="Briefly describe the support you are looking for..."></textarea></div>
    <div class="field" style="margin-top:13px"><label>Additional message <span class="optional">Optional</span></label><textarea id="request-message" placeholder="Anything else the provider should know?"></textarea></div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="requestSession()">Send Request</button>
  </section>`;
}

function requestCategoryChanged(categoryId){
  const select = document.getElementById("request-expertise");
  if(!select) return;
  [...select.options].forEach((opt, index) => {
    if(index === 0) return;
    opt.hidden = Boolean(categoryId) && opt.dataset.category !== categoryId;
  });
  select.value = "";
}

function requestSession(){
  const slot = state.slots.find(s => s.id === selectedSlot);
  if(!slot || slot.status !== "OPEN") return toast("That time is no longer available");

  const topic = document.getElementById("request-topic")?.value.trim() || "";
  const message = document.getElementById("request-message")?.value.trim() || "";
  const categoryId = document.getElementById("request-category")?.value || "";
  const expertiseId = document.getElementById("request-expertise")?.value || "";

  if(topic.length < 5) return toast("Please add a little more detail to the topic");

  const booking = {
    id: id("booking"),
    ref: `DH-${new Date().getFullYear()}-${String(state.bookings.length + 1).padStart(4,"0")}`,
    staffId: currentUser.id,
    staffUid: currentUser.uid || "",
    staffName: currentUser.name,
    staffEmail: currentUser.email,
    providerId: slot.providerId,
    programmeId: slot.programmeId,
    categoryId,
    expertiseId,
    slotId: slot.id,
    date: slot.date,
    start: slot.start,
    end: slot.end,
    topic,
    message,
    status: "REQUESTED",
    location: "",
    createdAt: new Date().toISOString()
  };

  state.bookings.unshift(booking);
  slot.status = "PENDING";
  addAudit("BOOKING_REQUESTED", "Booking", booking.id, `${currentUser.name} requested ${programme(slot.programmeId)?.name || "session"}`);
  save();
  selectedSlot = null;
  toast("Session request sent");
  go("sessions");
}

function sessionCard(b, actions=""){
  const p = provider(b.providerId);
  const prog = programme(b.programmeId);
  return `<article class="session-card">
    <div class="session-top"><div>${statusBadge(b.status)}<h3>${esc(prog?.name || "Development Session")}</h3><div class="helper">${esc(p?.name || "Provider")}</div></div><div class="session-ref">${esc(b.ref || "")}</div></div>
    <div class="session-details"><div><span>Date</span><strong>${dateFmt(b.date)}</strong></div><div><span>Time</span><strong>${esc(b.start)} – ${esc(b.end)}</strong></div><div><span>Location</span><strong>${esc(b.location || "To be confirmed")}</strong></div><div><span>Provider</span><strong>${esc(p?.name || "—")}</strong></div></div>
    <div class="session-topic"><span>Topic</span><p>${esc(b.topic || "")}</p></div>
    ${actions ? `<div class="session-actions">${actions}</div>` : ""}
  </article>`;
}

function staffSessions(){
  const mine = state.bookings.filter(b => b.staffId === currentUser.id || (b.staffEmail && b.staffEmail.toLowerCase() === currentUser.email.toLowerCase()));
  const tabs = ["REQUESTED","ACCEPTED","COMPLETED","DECLINED","CANCELLED"];
  const rows = mine.filter(b => b.status === sessionTab);

  return shell(
    heading("My Sessions", "Your development sessions", "Review pending requests, confirmed sessions and completed conversations.") +
    `<div class="tabs">${tabs.map(t => `<button class="${sessionTab === t ? "active" : ""}" onclick="setSessionTab('${t}')">${t === "ACCEPTED" ? "Upcoming" : t[0] + t.slice(1).toLowerCase()}</button>`).join("")}</div>
    ${rows.length ? rows.map(b => {
      let actions = "";
      if(["REQUESTED","ACCEPTED"].includes(b.status)) actions += `<button class="btn btn-danger btn-sm" onclick="cancelBooking('${b.id}')">Cancel Session</button>`;
      if(b.status === "COMPLETED"){
        const exists = state.feedback.some(f => f.bookingId === b.id && f.party === "STAFF");
        actions += exists ? `<span class="helper" style="color:var(--success);font-weight:800">✓ Feedback submitted</span>` : `<button class="btn btn-primary btn-sm" onclick="feedbackModal('${b.id}','STAFF')">Give Feedback</button>`;
      }
      return sessionCard(b, actions);
    }).join("") : `<div class="empty">No sessions in this category.</div>`}`
  );
}

function setSessionTab(value){ sessionTab = value; render(); }

function staffGrowth(){
  const enabled = programme("GROWTH_MENTORSHIP")?.enabled;
  if(!enabled) return shell(heading("Growth Mentorship", "Programme unavailable", "Growth Mentorship is currently disabled by HR.") + `<div class="empty">The programme is not currently open.</div>`);

  const batches = state.growthBatches.filter(batch => (batch.participants || []).some(p =>
    (p.email && currentUser.email && p.email.toLowerCase() === currentUser.email.toLowerCase()) ||
    (p.uid && currentUser.uid && p.uid === currentUser.uid)
  ));

  return shell(
    heading("Growth Mentorship", "My Growth Mentorship", "HR manages participant batches, programme meetings and notifications here.") +
    (batches.length ? `<div class="batch-grid">${batches.map(batchCard).join("")}</div>` : `<div class="empty"><strong>No active Growth Mentorship batch assigned.</strong>If you are included in a future batch, the details will appear here.</div>`)
  );
}

/* ----------------------------- PROVIDER ----------------------------- */
function providerOverview(){
  const p = myProvider();
  if(!p) return shell(providerAccessMissing());

  const requests = state.bookings.filter(b => b.providerId === p.id && b.status === "REQUESTED");
  const upcoming = state.bookings.filter(b => b.providerId === p.id && b.status === "ACCEPTED");
  const open = state.slots.filter(s => s.providerId === p.id && s.status === "OPEN");
  const completed = state.bookings.filter(b => b.providerId === p.id && b.status === "COMPLETED");

  return shell(
    heading("Provider Dashboard", `Welcome, ${p.name}`, "Review new requests and manage availability for the programmes assigned to your profile.", `<button class="btn btn-primary" onclick="go('availability')">+ Add Availability</button>`) +
    `<section class="stat-grid">${stat("New Requests", requests.length)}${stat("Upcoming", upcoming.length)}${stat("Open Slots", open.length)}${stat("Completed", completed.length)}</section>
    <section class="section"><div class="section-head"><div><h2>New requests</h2><p>Employees waiting for your response.</p></div><button class="btn btn-secondary btn-sm" onclick="go('requests')">View requests</button></div>${requests.slice(0,2).map(b => sessionCard(b)).join("") || `<div class="empty">No pending requests.</div>`}</section>`
  );
}

function providerAccessMissing(){
  return heading("Provider Access", "No provider profile linked", "Your account has the Provider role, but HR has not linked a provider profile to your user ID or email yet.") + `<div class="notice warn">Ask HR Admin to add your provider profile and set the same email address used for sign-in.</div>`;
}

function providerRequests(){
  const p = myProvider();
  if(!p) return shell(providerAccessMissing());
  const rows = state.bookings.filter(b => b.providerId === p.id && b.status === "REQUESTED");

  return shell(
    heading("Session Requests", "Requests awaiting your response", "Accept a request and set the meeting location, or decline it to reopen the time slot.") +
    (rows.length ? rows.map(b => `<article class="request-card"><div class="request-main"><div><span class="eyebrow">${esc(programme(b.programmeId)?.name || "Session")}</span><h3>${esc(b.staffName || "Staff")}</h3><div class="helper">${esc(b.staffUid || b.staffEmail || "")}</div></div>
      <div class="detail-grid"><div class="detail-box"><span>Date</span><strong>${dateFmt(b.date)}</strong></div><div class="detail-box"><span>Time</span><strong>${esc(b.start)} – ${esc(b.end)}</strong></div><div class="detail-box"><span>Category</span><strong>${esc(category(b.categoryId)?.name || "—")}</strong></div><div class="detail-box"><span>Expertise</span><strong>${esc(expertise(b.expertiseId)?.name || "—")}</strong></div></div>
      <div><span class="helper">What they would like to discuss</span><p style="font-size:12px">${esc(b.topic)}</p></div>${b.message ? `<div><span class="helper">Additional message</span><p style="font-size:12px">${esc(b.message)}</p></div>` : ""}</div>
      <aside class="request-action"><div class="eyebrow">Your Response</div><div class="field"><label>Meeting Location</label><input id="loc-${b.id}" placeholder="e.g. Microsoft Teams / Meeting Room"></div><button class="btn btn-primary full" onclick="acceptBooking('${b.id}')">Accept Request</button><button class="btn btn-danger full" onclick="declineBooking('${b.id}')">Decline</button></aside></article>`).join("") : `<div class="empty">You're all caught up. No pending requests.</div>`)
  );
}

function providerAvailability(){
  const p = myProvider();
  if(!p) return shell(providerAccessMissing());
  const slots = state.slots.filter(s => s.providerId === p.id).sort((a,b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  const programmes = enabledProgrammes("BOOKABLE").filter(x => p.programmeIds?.includes(x.id));

  return shell(
    heading("Availability", "Manage availability", "Publish times only for the programmes assigned to your provider profile.") +
    `<section class="card"><div class="section-head"><div><h2>Add availability</h2><p>${slots.length} total slots · monthly guide ${state.settings.slotTarget}</p></div></div>
      <div class="form-grid"><div class="field"><label>Programme</label><select id="slot-programme">${programmes.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><div class="field"><label>Date</label><input type="date" id="slot-date"></div><div class="field"><label>Start</label><input type="time" id="slot-start"></div><div class="field"><label>End</label><input type="time" id="slot-end"></div></div>
      <button class="btn btn-primary" style="margin-top:13px" ${programmes.length ? "" : "disabled"} onclick="addSlot('${p.id}')">Add Slot</button>
      ${!programmes.length ? `<div class="helper" style="margin-top:8px">No enabled bookable programme is assigned to this profile.</div>` : ""}
    </section>
    <section class="section">${slotTable(slots, false)}</section>`
  );
}

function providerProfile(){
  const p = myProvider();
  if(!p) return shell(providerAccessMissing());
  return shell(heading("My Profile", "Published provider profile", "This is what employees see in the provider directory. HR Admin maintains the profile details.") + `<div class="provider-grid">${providerCard(p, false)}</div>`);
}

/* ----------------------------- BOOKING ACTIONS ----------------------------- */
function acceptBooking(bookingId){
  const b = state.bookings.find(x => x.id === bookingId);
  const location = document.getElementById(`loc-${bookingId}`)?.value.trim() || "";
  if(!b) return;
  if(!location) return toast("Add the meeting location");
  b.status = "ACCEPTED";
  b.location = location;
  b.updatedAt = new Date().toISOString();
  const slot = state.slots.find(s => s.id === b.slotId);
  if(slot) slot.status = "BOOKED";
  addAudit("BOOKING_ACCEPTED", "Booking", b.id, `${provider(b.providerId)?.name || "Provider"} accepted ${b.ref}`);
  save(); toast("Request accepted"); render();
}

function declineBooking(bookingId){
  if(!confirm("Decline this request and reopen the time slot?")) return;
  const b = state.bookings.find(x => x.id === bookingId);
  if(!b) return;
  b.status = "DECLINED";
  b.updatedAt = new Date().toISOString();
  const slot = state.slots.find(s => s.id === b.slotId);
  if(slot) slot.status = "OPEN";
  addAudit("BOOKING_DECLINED", "Booking", b.id, `${b.ref} declined`);
  save(); toast("Request declined"); render();
}

function cancelBooking(bookingId){
  if(!confirm("Cancel this session?")) return;
  const b = state.bookings.find(x => x.id === bookingId);
  if(!b) return;
  b.status = "CANCELLED";
  b.updatedAt = new Date().toISOString();
  const slot = state.slots.find(s => s.id === b.slotId);
  if(slot) slot.status = "OPEN";
  addAudit("BOOKING_CANCELLED", "Booking", b.id, `${b.ref} cancelled`);
  save(); toast("Session cancelled"); render();
}

function completeBooking(bookingId){
  if(!confirm("Mark this session as completed?")) return;
  const b = state.bookings.find(x => x.id === bookingId);
  if(!b) return;
  b.status = "COMPLETED";
  b.updatedAt = new Date().toISOString();
  addAudit("BOOKING_COMPLETED", "Booking", b.id, `${b.ref} marked completed`);
  save(); toast("Session marked completed"); render();
}

function feedbackModal(bookingId, party){
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Feedback</div><h2>Session feedback</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="field"><label>How useful was the session?</label><select id="rating">${[5,4,3,2,1].map(n => `<option value="${n}">${n} / 5</option>`).join("")}</select></div>
    <div class="field" style="margin-top:12px"><label>Comments <span class="optional">Optional</span></label><textarea id="feedback-comments"></textarea></div>
    <button class="btn btn-primary full" style="margin-top:14px" onclick="submitFeedback('${bookingId}','${party}')">Submit Feedback</button>
  </div></div>`);
}

function submitFeedback(bookingId, party){
  if(state.feedback.some(f => f.bookingId === bookingId && f.party === party)) return toast("Feedback already submitted");
  state.feedback.push({ id:id("feedback"), bookingId, party, rating:+document.getElementById("rating").value, comments:document.getElementById("feedback-comments").value.trim(), createdAt:new Date().toISOString() });
  addAudit("FEEDBACK_SUBMITTED", "Booking", bookingId, `${party} feedback submitted`);
  save(); closeModal(); toast("Feedback submitted"); render();
}

/* ----------------------------- HR DASHBOARD ----------------------------- */
function hrOverview(){
  const activeProviders = state.providers.filter(p => p.active).length;
  const openSlots = state.slots.filter(s => s.status === "OPEN").length;
  const pending = state.bookings.filter(b => b.status === "REQUESTED").length;
  const completed = state.bookings.filter(b => b.status === "COMPLETED").length;
  const activeBatches = state.growthBatches.filter(b => !["COMPLETED","CANCELLED"].includes(b.status)).length;
  const avg = state.feedback.length ? (state.feedback.reduce((a,b) => a + Number(b.rating || 0), 0) / state.feedback.length).toFixed(1) : "—";
  const statuses = ["REQUESTED","ACCEPTED","COMPLETED","DECLINED","CANCELLED"];

  return shell(
    heading("HR Administration", "People Development Hub Dashboard", "Manage programmes, providers, Growth Mentorship batches, bookings, reporting and audit history from one place.", `<button class="btn btn-secondary" onclick="exportDashboard()">⇩ Export Excel</button>`) +
    `<section class="stat-grid">${stat("Active Providers",activeProviders)}${stat("Open Slots",openSlots)}${stat("Pending Requests",pending)}${stat("Completed Sessions",completed)}${stat("Growth Batches",activeBatches)}${stat("Feedback Rating",avg,state.feedback.length ? "out of 5" : "No responses yet")}</section>
    <section class="dashboard-grid">
      <div class="card"><div class="section-head"><div><h2>Programme availability</h2><p>Enable or disable employee-facing functions.</p></div><button class="btn btn-secondary btn-sm" onclick="go('programmes')">Manage</button></div>${state.programmes.map(programmeToggleRow).join("")}</div>
      <div class="card"><div class="section-head"><div><h2>Booking status</h2><p>Current one-to-one programme activity.</p></div></div><div class="chart-list">${statuses.map(s => { const n = state.bookings.filter(b => b.status === s).length; const pct = state.bookings.length ? (n/state.bookings.length)*100 : 0; return `<div><div class="chart-label"><span>${s}</span><strong>${n}</strong></div><div class="chart-track"><div class="chart-fill" style="width:${pct}%"></div></div></div>`; }).join("")}</div></div>
    </section>
    <section class="section"><div class="section-head"><div><h2>Recent audit activity</h2><p>Latest HR and programme actions.</p></div><button class="btn btn-secondary btn-sm" onclick="go('audit')">View audit trail</button></div>${auditPreview()}</section>`
  );
}

function programmeToggleRow(p){
  return `<div class="toggle-row"><div class="toggle-copy"><strong>${esc(p.name)}</strong><span>${esc(p.description || "")}</span></div><label class="switch"><input type="checkbox" ${p.enabled ? "checked" : ""} onchange="toggleProgramme('${p.id}',this.checked)"><span class="slider"></span></label></div>`;
}

function toggleProgramme(programmeId, enabled){
  const p = programme(programmeId);
  if(!p) return;
  p.enabled = Boolean(enabled);
  addAudit(enabled ? "PROGRAMME_ENABLED" : "PROGRAMME_DISABLED", "Programme", p.id, `${p.name} ${enabled ? "enabled" : "disabled"}`);
  save(); toast(`${p.name} ${enabled ? "enabled" : "disabled"}`); render();
}

/* ----------------------------- HR PROGRAMMES ----------------------------- */
function hrProgrammes(){
  return shell(
    heading("Programme Setup", "Programmes & provider roles", "Control Flash Mentoring, Coaching, Growth Mentorship and future programmes. Provider roles can be added without changing the code.", `<button class="btn btn-primary" onclick="programmeModal()">+ Add Programme</button>`) +
    `<section class="dashboard-grid">
      <div class="card"><div class="section-head"><div><h2>Programme availability</h2><p>Disabled programmes disappear from employee-facing areas.</p></div></div>${state.programmes.map(programmeToggleRow).join("")}</div>
      <div class="card"><div class="section-head"><div><h2>Provider roles</h2><p>Flash Mentor, ICF Coach and any future role are maintained here.</p></div><button class="btn btn-secondary btn-sm" onclick="providerTypeModal()">+ Add Role</button></div>
        ${state.providerTypes.length ? state.providerTypes.map(t => `<div class="toggle-row"><div class="toggle-copy"><strong>${esc(t.name)}</strong><span>${esc(programme(t.programmeId)?.name || "No programme linked")}</span></div><div class="actions"><button class="link-btn" onclick="providerTypeModal('${t.id}')">Edit</button><label class="switch"><input type="checkbox" ${t.active ? "checked" : ""} onchange="toggleProviderType('${t.id}',this.checked)"><span class="slider"></span></label></div></div>`).join("") : `<div class="empty">No provider roles configured.</div>`}
      </div>
    </section>
    <section class="section"><div class="section-head"><div><h2>All programmes</h2><p>Bookable programmes use provider profiles and slots. Batch programmes are managed by HR.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Programme</th><th>Mode</th><th>Status</th><th>Providers</th><th>Action</th></tr></thead><tbody>${state.programmes.map(p => `<tr><td><strong>${esc(p.name)}</strong><span class="table-sub">${esc(p.description || "")}</span></td><td>${esc(p.mode)}</td><td>${statusBadge(p.enabled ? "ACTIVE" : "DISABLED")}</td><td>${state.providers.filter(x => x.programmeIds?.includes(p.id)).length}</td><td><button class="link-btn" onclick="programmeModal('${p.id}')">Edit</button></td></tr>`).join("")}</tbody></table></div>
    </section>`
  );
}

function programmeModal(programmeId=""){
  const p = programmeId ? programme(programmeId) : null;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Programme Setup</div><h2>${p ? "Edit Programme" : "Add Programme"}</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="form-grid"><div class="field"><label>Programme Name</label><input id="pg-name" value="${esc(p?.name || "")}" placeholder="e.g. Executive Development"></div><div class="field"><label>Mode</label><select id="pg-mode"><option value="BOOKABLE" ${p?.mode === "BOOKABLE" ? "selected" : ""}>Bookable</option><option value="BATCH" ${p?.mode === "BATCH" ? "selected" : ""}>HR-managed Batch</option></select></div><div class="field"><label>Icon</label><input id="pg-icon" value="${esc(p?.icon || "◎")}" maxlength="3"></div></div>
    <div class="field" style="margin-top:12px"><label>Description</label><textarea id="pg-description">${esc(p?.description || "")}</textarea></div>
    <button class="btn btn-primary full" style="margin-top:14px" onclick="saveProgramme('${programmeId}')">${p ? "Save Changes" : "Add Programme"}</button>
  </div></div>`);
}

function saveProgramme(programmeId){
  const name = document.getElementById("pg-name").value.trim();
  const mode = document.getElementById("pg-mode").value;
  const icon = document.getElementById("pg-icon").value.trim() || "◎";
  const description = document.getElementById("pg-description").value.trim();
  if(!name) return toast("Add a programme name");

  if(programmeId){
    const p = programme(programmeId);
    Object.assign(p,{name,mode,icon,description});
    addAudit("PROGRAMME_UPDATED","Programme",p.id,`${name} updated`);
  }else{
    const p = { id:id("programme"), name, mode, icon, description, enabled:true };
    state.programmes.push(p);
    addAudit("PROGRAMME_CREATED","Programme",p.id,`${name} created`);
  }
  save(); closeModal(); toast(programmeId ? "Programme updated" : "Programme added"); render();
}

function providerTypeModal(typeId=""){
  const t = typeId ? providerType(typeId) : null;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Provider Role</div><h2>${t ? "Edit Role" : "Add Provider Role"}</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="field"><label>Role Name</label><input id="pt-name" value="${esc(t?.name || "")}" placeholder="e.g. Counsellor / Executive Mentor"></div>
    <div class="field" style="margin-top:12px"><label>Linked Programme</label><select id="pt-programme"><option value="">Not linked</option>${state.programmes.map(p => `<option value="${p.id}" ${t?.programmeId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div>
    <button class="btn btn-primary full" style="margin-top:14px" onclick="saveProviderType('${typeId}')">${t ? "Save Changes" : "Add Role"}</button>
  </div></div>`);
}

function saveProviderType(typeId){
  const name = document.getElementById("pt-name").value.trim();
  const programmeId = document.getElementById("pt-programme").value;
  if(!name) return toast("Add a role name");
  if(typeId){
    const t = providerType(typeId); Object.assign(t,{name,programmeId}); addAudit("PROVIDER_ROLE_UPDATED","ProviderRole",t.id,`${name} updated`);
  }else{
    const t = { id:id("ptype"), name, programmeId, active:true }; state.providerTypes.push(t); addAudit("PROVIDER_ROLE_CREATED","ProviderRole",t.id,`${name} created`);
  }
  save(); closeModal(); toast(typeId ? "Role updated" : "Role added"); render();
}

function toggleProviderType(typeId, active){
  const t = providerType(typeId); if(!t) return;
  t.active = Boolean(active); addAudit(active ? "PROVIDER_ROLE_ENABLED" : "PROVIDER_ROLE_DISABLED","ProviderRole",t.id,`${t.name} ${active ? "enabled" : "disabled"}`); save(); render();
}

/* ----------------------------- HR PROVIDERS ----------------------------- */
function hrProviders(){
  return shell(
    heading("Provider Directory", "Manage provider profiles", "HR owns the provider directory. Add photos, profile details, programme assignments, provider roles and expertise here.", `<button class="btn btn-primary" onclick="providerModal()">+ Add Provider</button>`) +
    `${state.providers.length ? `<div class="provider-grid">${state.providers.map(p => providerCard(p,true)).join("")}</div>` : `<div class="empty"><strong>No providers have been added.</strong>There are no hard-coded Flash Mentors or ICF Coaches. Add each profile here when ready.</div>`}`
  );
}

function providerModal(providerId=""){
  const p = providerId ? provider(providerId) : null;
  photoDraft = p?.photo || "";
  const programmeChecks = state.programmes.map(pg => `<label class="check"><input class="provider-programme" type="checkbox" value="${pg.id}" ${p?.programmeIds?.includes(pg.id) ? "checked" : ""}> ${esc(pg.name)}</label>`).join("");
  const typeChecks = state.providerTypes.filter(t => t.active || p?.providerTypeIds?.includes(t.id)).map(t => `<label class="check"><input class="provider-type" type="checkbox" value="${t.id}" ${p?.providerTypeIds?.includes(t.id) ? "checked" : ""}> ${esc(t.name)}</label>`).join("");
  const expertiseChecks = state.expertise.map(e => `<label class="check"><input class="provider-expertise" type="checkbox" value="${e.id}" ${p?.expertiseIds?.includes(e.id) ? "checked" : ""}> ${esc(e.name)}</label>`).join("");

  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal wide"><div class="modal-head"><div><div class="eyebrow">Provider Directory</div><h2>${p ? "Edit Provider" : "Add Provider"}</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px"><div class="photo-preview" id="photo-preview">${photoDraft ? `<img src="${esc(photoDraft)}" alt="Profile photo">` : "Profile photo"}</div><div class="field" style="flex:1"><label>Photo</label><input type="file" accept="image/*" onchange="previewPhoto(this)"><div class="helper">Image is stored inside this prototype's local data. Use a compressed headshot for testing.</div></div></div>
    <div class="form-grid"><div class="field"><label>UID</label><input id="pv-uid" value="${esc(p?.uid || "")}"></div><div class="field"><label>Name</label><input id="pv-name" value="${esc(p?.name || "")}"></div><div class="field"><label>Email / Sign-in Email</label><input id="pv-email" value="${esc(p?.email || "")}" type="email"></div><div class="field"><label>Job Title</label><input id="pv-title" value="${esc(p?.jobTitle || "")}"></div><div class="field"><label>Division / Department</label><input id="pv-department" value="${esc(p?.department || "")}"></div></div>
    <div class="field" style="margin-top:12px"><label>About</label><textarea id="pv-about">${esc(p?.about || "")}</textarea></div>
    <div class="field" style="margin-top:12px"><label>Programmes</label><div class="checkbox-grid">${programmeChecks || `<span class="helper">Create a programme first.</span>`}</div></div>
    <div class="field" style="margin-top:12px"><label>Provider Roles</label><div class="checkbox-grid">${typeChecks || `<span class="helper">Create a provider role first.</span>`}</div></div>
    <div class="field" style="margin-top:12px"><label>Expertise</label><div class="checkbox-grid">${expertiseChecks || `<span class="helper">No expertise configured yet. This is optional.</span>`}</div></div>
    <button class="btn btn-primary full" style="margin-top:16px" onclick="saveProvider('${providerId}')">${p ? "Save Provider" : "Add Provider"}</button>
  </div></div>`);
}

function previewPhoto(input){
  const file = input.files?.[0];
  if(!file) return;
  if(file.size > 1500000){ input.value = ""; return toast("Please use an image under 1.5 MB for this prototype"); }
  const reader = new FileReader();
  reader.onload = () => {
    photoDraft = reader.result;
    const preview = document.getElementById("photo-preview");
    if(preview) preview.innerHTML = `<img src="${photoDraft}" alt="Profile photo preview">`;
  };
  reader.readAsDataURL(file);
}

function saveProvider(providerId){
  const uid = document.getElementById("pv-uid").value.trim();
  const name = document.getElementById("pv-name").value.trim();
  const email = document.getElementById("pv-email").value.trim();
  const jobTitle = document.getElementById("pv-title").value.trim();
  const department = document.getElementById("pv-department").value.trim();
  const about = document.getElementById("pv-about").value.trim();
  const programmeIds = [...document.querySelectorAll(".provider-programme:checked")].map(x => x.value);
  const providerTypeIds = [...document.querySelectorAll(".provider-type:checked")].map(x => x.value);
  const expertiseIds = [...document.querySelectorAll(".provider-expertise:checked")].map(x => x.value);

  if(!name || !jobTitle || !department) return toast("Complete name, job title and department");
  if(!programmeIds.length) return toast("Assign at least one programme");
  if(!providerTypeIds.length) return toast("Assign at least one provider role");

  if(providerId){
    const p = provider(providerId);
    Object.assign(p,{uid,name,email,jobTitle,department,about,programmeIds,providerTypeIds,expertiseIds,photo:photoDraft});
    addAudit("PROVIDER_UPDATED","Provider",p.id,`${name} profile updated`);
  }else{
    const p = { id:id("provider"), userId:"", uid,name,email,jobTitle,department,about,programmeIds,providerTypeIds,expertiseIds,photo:photoDraft,active:true,createdAt:new Date().toISOString() };
    state.providers.push(p);
    addAudit("PROVIDER_CREATED","Provider",p.id,`${name} added to provider directory`);
  }

  save(); closeModal(); toast(providerId ? "Provider updated" : "Provider added"); render();
}

function toggleProvider(providerId){
  const p = provider(providerId); if(!p) return;
  p.active = !p.active;
  addAudit(p.active ? "PROVIDER_ACTIVATED" : "PROVIDER_DEACTIVATED","Provider",p.id,`${p.name} ${p.active ? "activated" : "deactivated"}`);
  save(); render();
}

/* ----------------------------- AVAILABILITY ----------------------------- */
function slotTable(slots, showProvider=true){
  if(!slots.length) return `<div class="empty">No availability has been published.</div>`;
  return `<div class="table-wrap"><table><thead><tr>${showProvider ? "<th>Provider</th>" : ""}<th>Programme</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>${slots.map(s => `<tr>${showProvider ? `<td>${esc(provider(s.providerId)?.name || "—")}</td>` : ""}<td>${esc(programme(s.programmeId)?.name || "—")}</td><td>${dateFmt(s.date)}</td><td>${esc(s.start)} – ${esc(s.end)}</td><td>${statusBadge(s.status)}</td><td><div class="actions"><button class="link-btn" ${s.status !== "OPEN" ? "disabled" : ""} onclick="editSlot('${s.id}')">Edit</button><button class="link-btn danger" ${s.status !== "OPEN" ? "disabled" : ""} onclick="deleteSlot('${s.id}')">Delete</button></div></td></tr>`).join("")}</tbody></table></div>`;
}

function addSlot(providerId){
  const programmeId = document.getElementById("slot-programme")?.value || "";
  const date = document.getElementById("slot-date")?.value || "";
  const start = document.getElementById("slot-start")?.value || "";
  const end = document.getElementById("slot-end")?.value || "";
  if(!programmeId || !date || !start || !end) return toast("Complete programme, date and time");
  if(end <= start) return toast("End time must be later than start time");
  if(state.slots.some(s => s.providerId === providerId && s.date === date && start < s.end && end > s.start)) return toast("This time overlaps with an existing slot");

  const slot = { id:id("slot"), providerId, programmeId, date, start, end, status:"OPEN", createdAt:new Date().toISOString() };
  state.slots.push(slot);
  addAudit("AVAILABILITY_CREATED","Availability",slot.id,`${provider(providerId)?.name || "Provider"} · ${date} ${start}-${end}`);
  save(); toast("Availability added"); render();
}

function editSlot(slotId){
  const s = state.slots.find(x => x.id === slotId); if(!s || s.status !== "OPEN") return;
  const p = provider(s.providerId);
  const progs = enabledProgrammes("BOOKABLE").filter(pg => p?.programmeIds?.includes(pg.id));
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Availability</div><h2>Edit Slot</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="form-grid"><div class="field"><label>Programme</label><select id="edit-programme">${progs.map(pg => `<option value="${pg.id}" ${s.programmeId === pg.id ? "selected" : ""}>${esc(pg.name)}</option>`).join("")}</select></div><div class="field"><label>Date</label><input type="date" id="edit-date" value="${esc(s.date)}"></div><div class="field"><label>Start</label><input type="time" id="edit-start" value="${esc(s.start)}"></div><div class="field"><label>End</label><input type="time" id="edit-end" value="${esc(s.end)}"></div></div>
    <button class="btn btn-primary full" style="margin-top:14px" onclick="saveEditedSlot('${slotId}')">Save Changes</button>
  </div></div>`);
}

function saveEditedSlot(slotId){
  const s = state.slots.find(x => x.id === slotId); if(!s) return;
  const programmeId = document.getElementById("edit-programme").value;
  const date = document.getElementById("edit-date").value;
  const start = document.getElementById("edit-start").value;
  const end = document.getElementById("edit-end").value;
  if(!programmeId || !date || !start || !end || end <= start) return toast("Check programme, date and times");
  if(state.slots.some(x => x.id !== slotId && x.providerId === s.providerId && x.date === date && start < x.end && end > x.start)) return toast("This time overlaps with another slot");
  Object.assign(s,{programmeId,date,start,end});
  addAudit("AVAILABILITY_UPDATED","Availability",s.id,`${provider(s.providerId)?.name || "Provider"} slot updated`);
  save(); closeModal(); toast("Slot updated"); render();
}

function deleteSlot(slotId){
  const s = state.slots.find(x => x.id === slotId); if(!s || s.status !== "OPEN") return;
  if(!confirm("Delete this open availability slot?")) return;
  state.slots = state.slots.filter(x => x.id !== slotId);
  addAudit("AVAILABILITY_DELETED","Availability",slotId,`${provider(s.providerId)?.name || "Provider"} open slot deleted`);
  save(); toast("Slot deleted"); render();
}

function hrAvailability(){
  const slots = [...state.slots].sort((a,b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  return shell(
    heading("Availability", "Availability oversight", "HR can add, edit and remove unused slots across all provider profiles.", `<button class="btn btn-primary" onclick="hrSlotModal()">+ Add Slot</button>`) + slotTable(slots,true)
  );
}

function hrSlotModal(){
  const activeProviders = state.providers.filter(p => p.active);
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Availability</div><h2>Add Provider Slot</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="field"><label>Provider</label><select id="hr-slot-provider" onchange="refreshHrSlotProgrammes(this.value)"><option value="">Select provider</option>${activeProviders.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join("")}</select></div>
    <div class="field" style="margin-top:12px"><label>Programme</label><select id="hr-slot-programme"><option value="">Select provider first</option></select></div>
    <div class="form-grid" style="margin-top:12px"><div class="field"><label>Date</label><input type="date" id="hr-slot-date"></div><div class="field"><label>Start</label><input type="time" id="hr-slot-start"></div><div class="field"><label>End</label><input type="time" id="hr-slot-end"></div></div>
    <button class="btn btn-primary full" style="margin-top:14px" onclick="saveHrSlot()">Add Slot</button>
  </div></div>`);
}

function refreshHrSlotProgrammes(providerId){
  const p = provider(providerId);
  const select = document.getElementById("hr-slot-programme");
  if(!select) return;
  const list = enabledProgrammes("BOOKABLE").filter(pg => p?.programmeIds?.includes(pg.id));
  select.innerHTML = `<option value="">Select programme</option>${list.map(pg => `<option value="${pg.id}">${esc(pg.name)}</option>`).join("")}`;
}

function saveHrSlot(){
  const providerId = document.getElementById("hr-slot-provider").value;
  const programmeId = document.getElementById("hr-slot-programme").value;
  const date = document.getElementById("hr-slot-date").value;
  const start = document.getElementById("hr-slot-start").value;
  const end = document.getElementById("hr-slot-end").value;
  if(!providerId || !programmeId || !date || !start || !end || end <= start) return toast("Check provider, programme, date and time");
  if(state.slots.some(s => s.providerId === providerId && s.date === date && start < s.end && end > s.start)) return toast("This time overlaps with an existing slot");
  const slot = { id:id("slot"), providerId, programmeId, date, start, end, status:"OPEN", createdAt:new Date().toISOString() };
  state.slots.push(slot); addAudit("AVAILABILITY_CREATED_BY_HR","Availability",slot.id,`${provider(providerId)?.name || "Provider"} · ${date} ${start}-${end}`); save(); closeModal(); toast("Slot added"); render();
}

/* ----------------------------- HR BOOKINGS ----------------------------- */
function hrBookings(){
  return shell(
    heading("Booking Oversight", "All one-to-one bookings", "Review Flash Mentoring, Coaching and any future bookable programme sessions.", `<button class="btn btn-secondary" onclick="exportBookings()">⇩ Export Excel</button>`) +
    (state.bookings.length ? `<div class="table-wrap"><table><thead><tr><th>Reference</th><th>Staff</th><th>Provider</th><th>Programme</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${state.bookings.map(b => `<tr><td><strong>${esc(b.ref)}</strong><span class="table-sub">${esc(b.topic || "")}</span></td><td>${esc(b.staffName || "—")}<span class="table-sub">${esc(b.staffUid || b.staffEmail || "")}</span></td><td>${esc(provider(b.providerId)?.name || "—")}</td><td>${esc(programme(b.programmeId)?.name || "—")}</td><td>${dateFmt(b.date)}<span class="table-sub">${esc(b.start)} – ${esc(b.end)}</span></td><td>${statusBadge(b.status)}</td><td><div class="actions">${b.status === "ACCEPTED" ? `<button class="link-btn" onclick="completeBooking('${b.id}')">Complete</button>` : ""}${["REQUESTED","ACCEPTED"].includes(b.status) ? `<button class="link-btn danger" onclick="cancelBooking('${b.id}')">Cancel</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">No bookings yet.</div>`)
  );
}

/* ----------------------------- GROWTH MENTORSHIP ----------------------------- */
function hrGrowth(){
  const enabled = programme("GROWTH_MENTORSHIP")?.enabled;
  return shell(
    heading("Growth Mentorship", "Growth Mentorship batches", "Create and maintain staff batches, schedule programme meetings, track participants and send meeting notifications.", `<button class="btn btn-primary" onclick="batchModal()">+ Create Batch</button><button class="btn btn-secondary" onclick="exportGrowthBatches()">⇩ Export Excel</button>`) +
    (!enabled ? `<div class="notice warn">Growth Mentorship is currently disabled for staff. HR can still prepare batches here.</div>` : "") +
    (state.growthBatches.length ? `<div class="batch-grid">${state.growthBatches.map(batchCard).join("")}</div>` : `<div class="empty"><strong>No Growth Mentorship batches yet.</strong>Create a batch, add staff participants and schedule the programme meeting.</div>`)
  );
}

function batchCard(batch){
  const participants = batch.participants || [];
  const notified = participants.filter(p => p.status === "NOTIFIED").length;
  const facilitator = provider(batch.providerId);
  return `<article class="batch-card"><div class="batch-top"><div><div class="eyebrow">${esc(batch.cycle || "Growth Mentorship")}</div><h3>${esc(batch.name)}</h3><p>${esc(batch.startDate ? `${dateFmt(batch.startDate)}${batch.endDate ? ` – ${dateFmt(batch.endDate)}` : ""}` : "Dates not set")}</p></div>${statusBadge(batch.status || "PLANNED")}</div>
    <div class="batch-metrics"><div><span>Participants</span><strong>${participants.length}</strong></div><div><span>Notified</span><strong>${notified}</strong></div><div><span>Facilitator</span><strong>${esc(facilitator?.name || "TBC")}</strong></div></div>
    <div class="batch-actions">${role === "HR_ADMIN" ? `<button class="btn btn-secondary btn-sm" onclick="manageBatchModal('${batch.id}')">Manage</button><button class="btn btn-primary btn-sm" onclick="sendBatchNotification('${batch.id}')">Send Meeting Notification</button><button class="btn btn-ghost btn-sm" onclick="downloadBatchICS('${batch.id}')">Calendar File</button>` : `<button class="btn btn-secondary btn-sm" onclick="viewBatchModal('${batch.id}')">View details</button>`}</div>
  </article>`;
}

function batchModal(batchId=""){
  const b = batchId ? growthBatch(batchId) : null;
  const participantText = (b?.participants || []).map(p => [p.uid,p.name,p.email].filter(Boolean).join(", ")).join("\n");
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal wide"><div class="modal-head"><div><div class="eyebrow">Growth Mentorship</div><h2>${b ? "Edit Batch" : "Create Batch"}</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="form-grid"><div class="field"><label>Batch Name</label><input id="batch-name" value="${esc(b?.name || "")}" placeholder="e.g. Growth Mentorship - Batch 01"></div><div class="field"><label>Cycle / Cohort</label><input id="batch-cycle" value="${esc(b?.cycle || "")}" placeholder="e.g. Q4 2026"></div><div class="field"><label>Start Date</label><input type="date" id="batch-start" value="${esc(b?.startDate || "")}"></div><div class="field"><label>End Date</label><input type="date" id="batch-end" value="${esc(b?.endDate || "")}"></div></div>
    <div class="field" style="margin-top:12px"><label>Participants</label><textarea id="batch-participants" placeholder="One staff per line: UID, Name, Email">${esc(participantText)}</textarea><div class="helper">Example: 2515, Fathimath Rayya Hilmy, name@bankofmaldives.com.mv</div></div>
    <div class="field" style="margin-top:12px"><label>Notes <span class="optional">Optional</span></label><textarea id="batch-notes">${esc(b?.notes || "")}</textarea></div>
    <button class="btn btn-primary full" style="margin-top:14px" onclick="saveBatch('${batchId}')">${b ? "Save Batch" : "Create Batch"}</button>
  </div></div>`);
}

function parseParticipants(text){
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const parts = line.split(",").map(x => x.trim());
    return { id:id("participant"), uid:parts[0] || "", name:parts[1] || parts[0] || "", email:parts[2] || "", status:"PENDING" };
  });
}

function saveBatch(batchId){
  const name = document.getElementById("batch-name").value.trim();
  const cycle = document.getElementById("batch-cycle").value.trim();
  const startDate = document.getElementById("batch-start").value;
  const endDate = document.getElementById("batch-end").value;
  const notes = document.getElementById("batch-notes").value.trim();
  const participants = parseParticipants(document.getElementById("batch-participants").value);
  if(!name) return toast("Add a batch name");
  if(startDate && endDate && endDate < startDate) return toast("End date cannot be before start date");

  if(batchId){
    const b = growthBatch(batchId);
    const existingStatus = new Map((b.participants || []).map(p => [`${p.uid}|${p.email}`.toLowerCase(),p.status]));
    participants.forEach(p => p.status = existingStatus.get(`${p.uid}|${p.email}`.toLowerCase()) || "PENDING");
    Object.assign(b,{name,cycle,startDate,endDate,notes,participants,updatedAt:new Date().toISOString()});
    addAudit("GROWTH_BATCH_UPDATED","GrowthBatch",b.id,`${name} updated with ${participants.length} participant(s)`);
  }else{
    const b = { id:id("batch"), name,cycle,startDate,endDate,notes,participants,status:"PLANNED",providerId:"",meetingDate:"",meetingStart:"",meetingEnd:"",location:"",lastNotifiedAt:"",createdAt:new Date().toISOString() };
    state.growthBatches.unshift(b);
    addAudit("GROWTH_BATCH_CREATED","GrowthBatch",b.id,`${name} created with ${participants.length} participant(s)`);
  }
  save(); closeModal(); toast(batchId ? "Batch updated" : "Batch created"); render();
}

function manageBatchModal(batchId){
  const b = growthBatch(batchId); if(!b) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal wide"><div class="modal-head"><div><div class="eyebrow">Growth Mentorship</div><h2>${esc(b.name)}</h2><div class="helper">Manage facilitator, meeting details and participant notifications.</div></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="form-grid"><div class="field"><label>Growth Mentor / Facilitator</label><select id="manage-provider"><option value="">To be confirmed</option>${state.providers.filter(p => p.active && p.programmeIds?.includes("GROWTH_MENTORSHIP")).map(p => `<option value="${p.id}" ${b.providerId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></div><div class="field"><label>Meeting Date</label><input type="date" id="manage-date" value="${esc(b.meetingDate || "")}"></div><div class="field"><label>Start</label><input type="time" id="manage-start" value="${esc(b.meetingStart || "")}"></div><div class="field"><label>End</label><input type="time" id="manage-end" value="${esc(b.meetingEnd || "")}"></div><div class="field"><label>Location / Teams Link</label><input id="manage-location" value="${esc(b.location || "")}" placeholder="Microsoft Teams / Meeting Room"></div><div class="field"><label>Status</label><select id="manage-status">${["PLANNED","SCHEDULED","LIVE","COMPLETED","CANCELLED"].map(s => `<option value="${s}" ${b.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></div></div>
    <div class="section"><div class="section-head"><div><h2>Participants</h2><p>${(b.participants || []).length} staff in this batch.</p></div><button class="btn btn-secondary btn-sm" onclick="closeModal();batchModal('${b.id}')">Edit Participant List</button></div>${participantTable(b)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px"><button class="btn btn-primary" onclick="saveBatchMeeting('${b.id}')">Save Meeting Details</button><button class="btn btn-secondary" onclick="sendBatchNotification('${b.id}')">Send Meeting Notification</button><button class="btn btn-secondary" onclick="downloadBatchICS('${b.id}')">Download Calendar File</button></div>
  </div></div>`);
}

function participantTable(b){
  const rows = b.participants || [];
  if(!rows.length) return `<div class="empty">No participants added.</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>UID</th><th>Name</th><th>Email</th><th>Notification</th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.uid || "—")}</td><td>${esc(p.name || "—")}</td><td>${esc(p.email || "—")}</td><td>${statusBadge(p.status || "PENDING")}</td></tr>`).join("")}</tbody></table></div>`;
}

function saveBatchMeeting(batchId){
  const b = growthBatch(batchId); if(!b) return;
  const providerId = document.getElementById("manage-provider").value;
  const meetingDate = document.getElementById("manage-date").value;
  const meetingStart = document.getElementById("manage-start").value;
  const meetingEnd = document.getElementById("manage-end").value;
  const location = document.getElementById("manage-location").value.trim();
  const status = document.getElementById("manage-status").value;
  if(meetingStart && meetingEnd && meetingEnd <= meetingStart) return toast("Meeting end time must be later than start time");
  Object.assign(b,{providerId,meetingDate,meetingStart,meetingEnd,location,status,updatedAt:new Date().toISOString()});
  addAudit("GROWTH_MEETING_UPDATED","GrowthBatch",b.id,`${b.name} meeting details updated`);
  save(); closeModal(); toast("Meeting details saved"); render();
}

function sendBatchNotification(batchId){
  const b = growthBatch(batchId); if(!b) return;

  // If the manage modal is open, save its latest values first without closing.
  if(document.getElementById("manage-date")){
    b.providerId = document.getElementById("manage-provider").value;
    b.meetingDate = document.getElementById("manage-date").value;
    b.meetingStart = document.getElementById("manage-start").value;
    b.meetingEnd = document.getElementById("manage-end").value;
    b.location = document.getElementById("manage-location").value.trim();
    b.status = document.getElementById("manage-status").value;
  }

  if(!b.meetingDate || !b.meetingStart || !b.meetingEnd || !b.location) return toast("Add meeting date, time and location first");
  if(!(b.participants || []).length) return toast("Add participants before sending a notification");

  /*
    Integration hook:
    POST /api/growth-mentorship/notify
    Body: { batchId, participants, meetingDate, meetingStart, meetingEnd, location, facilitator }
    A Power Automate flow / Microsoft Graph service can then create Outlook/Teams meeting invitations.
  */
  const now = new Date().toISOString();
  b.lastNotifiedAt = now;
  b.status = "SCHEDULED";
  b.participants.forEach(p => { p.status = "NOTIFIED"; p.notifiedAt = now; });
  addAudit("GROWTH_MEETING_NOTIFICATION_SENT","GrowthBatch",b.id,`${b.name}: meeting notification prepared for ${b.participants.length} participant(s)`);
  save();
  closeModal();
  toast("Meeting notification recorded for the batch");
  render();
}

function viewBatchModal(batchId){
  const b = growthBatch(batchId); if(!b) return;
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><div><div class="eyebrow">Growth Mentorship</div><h2>${esc(b.name)}</h2></div><button class="close" onclick="closeModal()">×</button></div>
    <div class="detail-grid"><div class="detail-box"><span>Status</span><strong>${esc(b.status || "PLANNED")}</strong></div><div class="detail-box"><span>Meeting Date</span><strong>${dateFmt(b.meetingDate)}</strong></div><div class="detail-box"><span>Time</span><strong>${esc(b.meetingStart || "—")} ${b.meetingEnd ? `– ${esc(b.meetingEnd)}` : ""}</strong></div><div class="detail-box"><span>Location</span><strong>${esc(b.location || "TBC")}</strong></div></div>
    <div class="field"><label>Facilitator</label><div>${esc(provider(b.providerId)?.name || "To be confirmed")}</div></div>
  </div></div>`);
}

function downloadBatchICS(batchId){
  const b = growthBatch(batchId); if(!b) return;
  if(!b.meetingDate || !b.meetingStart || !b.meetingEnd) return toast("Add meeting date and time first");

  const toICS = (date,time) => `${date.replaceAll("-","")}T${time.replace(":","")}00`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BML//Development Hub//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@bml-development-hub`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")}`,
    `DTSTART:${toICS(b.meetingDate,b.meetingStart)}`,
    `DTEND:${toICS(b.meetingDate,b.meetingEnd)}`,
    `SUMMARY:${(b.name || "Growth Mentorship").replaceAll("\n"," ")}`,
    `LOCATION:${(b.location || "").replaceAll("\n"," ")}`,
    `DESCRIPTION:${(b.notes || "Growth Mentorship session").replaceAll("\n"," ")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
  downloadBlob(`${safeFileName(b.name)}.ics`, ics, "text/calendar;charset=utf-8");
  addAudit("GROWTH_CALENDAR_FILE_EXPORTED","GrowthBatch",b.id,`${b.name} calendar file exported`);
  save();
}

/* ----------------------------- CATEGORIES & EXPERTISE ----------------------------- */
function hrCategories(){
  return shell(
    heading("Programme Setup", "Categories & expertise", "These values are fully HR-maintained. Nothing is preloaded or hard-coded.") +
    `<section class="dashboard-grid"><div class="card"><h2>Add Category</h2><div class="field"><label>Category Name</label><input id="cat-name" placeholder="e.g. Leadership"></div><button class="btn btn-primary" style="margin-top:12px" onclick="addCategory()">Add Category</button></div>
      <div class="card"><h2>Add Expertise</h2><div class="field"><label>Category</label><select id="exp-category"><option value="">Select category</option>${state.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div><div class="field" style="margin-top:10px"><label>Expertise Name</label><input id="exp-name" placeholder="e.g. People Leadership"></div><button class="btn btn-primary" style="margin-top:12px" onclick="addExpertise()">Add Expertise</button></div></section>
    <section class="section">${state.categories.length ? `<div class="provider-grid">${state.categories.map(c => `<article class="card"><div class="section-head"><div><h2>${esc(c.name)}</h2><p>${state.expertise.filter(e => e.categoryId === c.id).length} expertise item(s)</p></div><button class="link-btn danger" onclick="deleteCategory('${c.id}')">Delete</button></div><div class="tags">${state.expertise.filter(e => e.categoryId === c.id).map(e => `<span class="tag">${esc(e.name)} <button class="link-btn danger" style="margin-left:4px" onclick="deleteExpertise('${e.id}')">×</button></span>`).join("") || `<span class="helper">No expertise added.</span>`}</div></article>`).join("")}</div>` : `<div class="empty"><strong>No categories configured.</strong>Add only the categories HR actually wants employees to use.</div>`}</section>`
  );
}

function addCategory(){
  const name = document.getElementById("cat-name").value.trim(); if(!name) return toast("Add a category name");
  if(state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast("That category already exists");
  const c = { id:id("category"), name }; state.categories.push(c); addAudit("CATEGORY_CREATED","Category",c.id,`${name} created`); save(); toast("Category added"); render();
}

function addExpertise(){
  const categoryId = document.getElementById("exp-category").value;
  const name = document.getElementById("exp-name").value.trim();
  if(!categoryId || !name) return toast("Select a category and add expertise");
  const e = { id:id("expertise"), categoryId, name }; state.expertise.push(e); addAudit("EXPERTISE_CREATED","Expertise",e.id,`${name} created under ${category(categoryId)?.name || "category"}`); save(); toast("Expertise added"); render();
}

function deleteCategory(categoryId){
  const c = category(categoryId); if(!c) return;
  if(!confirm(`Delete ${c.name} and its expertise items?`)) return;
  const expertiseIds = state.expertise.filter(e => e.categoryId === categoryId).map(e => e.id);
  state.categories = state.categories.filter(x => x.id !== categoryId);
  state.expertise = state.expertise.filter(x => x.categoryId !== categoryId);
  state.providers.forEach(p => p.expertiseIds = (p.expertiseIds || []).filter(x => !expertiseIds.includes(x)));
  addAudit("CATEGORY_DELETED","Category",categoryId,`${c.name} and related expertise deleted`); save(); toast("Category deleted"); render();
}

function deleteExpertise(expertiseId){
  const e = expertise(expertiseId); if(!e) return;
  if(!confirm(`Delete ${e.name}?`)) return;
  state.expertise = state.expertise.filter(x => x.id !== expertiseId);
  state.providers.forEach(p => p.expertiseIds = (p.expertiseIds || []).filter(x => x !== expertiseId));
  addAudit("EXPERTISE_DELETED","Expertise",expertiseId,`${e.name} deleted`); save(); toast("Expertise deleted"); render();
}

/* ----------------------------- AUDIT ----------------------------- */
function auditPreview(){
  const rows = state.auditTrail.slice(0,6);
  return rows.length ? `<div class="card">${rows.map(auditRow).join("")}</div>` : `<div class="empty">No audit activity recorded yet.</div>`;
}

function auditRow(a){
  return `<div class="audit-item"><div><small>Time</small><strong>${timestampFmt(a.timestamp)}</strong></div><div><small>Actor</small><strong>${esc(a.actorName || "—")}</strong></div><div><small>Action</small><strong>${esc(a.action || "—")}</strong></div><div class="audit-detail">${esc(a.detail || `${a.entityType || ""} ${a.entityId || ""}`)}</div></div>`;
}

function hrAudit(){
  const q = auditSearch.toLowerCase();
  const rows = state.auditTrail.filter(a => !q || `${a.actorName} ${a.action} ${a.entityType} ${a.entityId} ${a.detail}`.toLowerCase().includes(q));
  return shell(
    heading("Governance", "Audit Trail", "Review configuration changes, provider maintenance, booking actions, Growth Mentorship activity and exports.", `<button class="btn btn-secondary" onclick="exportAudit()">⇩ Export Excel</button>`) +
    `<section class="filter-panel"><div class="field"><label>Search audit trail</label><input value="${esc(auditSearch)}" placeholder="Actor, action, entity or detail" oninput="setAuditSearch(this.value)"></div><div class="field"><label>Records</label><input value="${rows.length}" disabled></div></section>
    ${rows.length ? `<div class="card">${rows.map(auditRow).join("")}</div>` : `<div class="empty">No matching audit records.</div>`}`
  );
}

function setAuditSearch(value){ auditSearch = value; render(); }

/* ----------------------------- EXCEL EXPORT ----------------------------- */
function safeFileName(value){
  return String(value || "export").replace(/[^a-z0-9-_]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase() || "export";
}

function downloadBlob(filename, content, mime){
  const blob = new Blob([content], { type:mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function excelCell(value){
  const isNumber = typeof value === "number" && Number.isFinite(value);
  return `<Cell><Data ss:Type="${isNumber ? "Number" : "String"}">${xmlEsc(value ?? "")}</Data></Cell>`;
}

function excelWorksheet(name, rows){
  const safeRows = rows.length ? rows : [{ Message:"No data" }];
  const headers = [...new Set(safeRows.flatMap(r => Object.keys(r)))];
  return `<Worksheet ss:Name="${xmlEsc(name.slice(0,31))}"><Table><Row>${headers.map(excelCell).join("")}</Row>${safeRows.map(r => `<Row>${headers.map(h => excelCell(r[h] ?? "")).join("")}</Row>`).join("")}</Table></Worksheet>`;
}

function exportWorkbook(filename, sheets){
  const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${sheets.map(s => excelWorksheet(s.name,s.rows)).join("")}</Workbook>`;
  downloadBlob(filename.endsWith(".xls") ? filename : `${filename}.xls`, xml, "application/vnd.ms-excel;charset=utf-8");
}

function bookingRows(){
  return state.bookings.map(b => ({ Reference:b.ref, Staff_UID:b.staffUid, Staff_Name:b.staffName, Staff_Email:b.staffEmail, Provider:provider(b.providerId)?.name || "", Programme:programme(b.programmeId)?.name || "", Category:category(b.categoryId)?.name || "", Expertise:expertise(b.expertiseId)?.name || "", Date:b.date, Start:b.start, End:b.end, Location:b.location, Status:b.status, Topic:b.topic, Created_At:b.createdAt || "" }));
}

function providerRows(){
  return state.providers.map(p => ({ UID:p.uid, Name:p.name, Email:p.email, Job_Title:p.jobTitle, Department:p.department, Provider_Roles:(p.providerTypeIds || []).map(x => providerType(x)?.name || "").join("; "), Programmes:(p.programmeIds || []).map(x => programme(x)?.name || "").join("; "), Expertise:(p.expertiseIds || []).map(x => expertise(x)?.name || "").join("; "), Status:p.active ? "ACTIVE" : "INACTIVE" }));
}

function batchRows(){
  return state.growthBatches.map(b => ({ Batch:b.name, Cycle:b.cycle, Start_Date:b.startDate, End_Date:b.endDate, Status:b.status, Facilitator:provider(b.providerId)?.name || "", Meeting_Date:b.meetingDate, Meeting_Start:b.meetingStart, Meeting_End:b.meetingEnd, Location:b.location, Participants:(b.participants || []).length, Notified:(b.participants || []).filter(p => p.status === "NOTIFIED").length, Last_Notified_At:b.lastNotifiedAt || "" }));
}

function participantRows(){
  return state.growthBatches.flatMap(b => (b.participants || []).map(p => ({ Batch:b.name, Cycle:b.cycle, UID:p.uid, Name:p.name, Email:p.email, Notification_Status:p.status, Notified_At:p.notifiedAt || "" })));
}

function auditRows(){
  return state.auditTrail.map(a => ({ Timestamp:a.timestamp, Actor:a.actorName, Role:a.role, Action:a.action, Entity_Type:a.entityType, Entity_ID:a.entityId, Detail:a.detail }));
}

function exportDashboard(){
  exportWorkbook("development-hub-dashboard.xls", [
    { name:"Providers", rows:providerRows() },
    { name:"Bookings", rows:bookingRows() },
    { name:"Growth Batches", rows:batchRows() },
    { name:"Growth Participants", rows:participantRows() },
    { name:"Audit Trail", rows:auditRows() }
  ]);
  addAudit("DASHBOARD_EXPORTED","Report","dashboard","HR dashboard workbook exported"); save(); toast("Excel workbook exported");
}

function exportBookings(){ exportWorkbook("development-hub-bookings.xls",[{name:"Bookings",rows:bookingRows()}]); addAudit("BOOKINGS_EXPORTED","Report","bookings","Bookings exported"); save(); }
function exportGrowthBatches(){ exportWorkbook("growth-mentorship-batches.xls",[{name:"Batches",rows:batchRows()},{name:"Participants",rows:participantRows()}]); addAudit("GROWTH_BATCHES_EXPORTED","Report","growth-batches","Growth Mentorship workbook exported"); save(); }
function exportAudit(){ exportWorkbook("development-hub-audit-trail.xls",[{name:"Audit Trail",rows:auditRows()}]); addAudit("AUDIT_EXPORTED","Report","audit","Audit trail exported"); save(); }

/* ----------------------------- RENDER ----------------------------- */
function render(){
  const app = document.getElementById("app");
  if(!app) return;

  if(!hasRole(role)) role = resolveInitialRole();

  if(role === "STAFF"){
    if(view === "find") app.innerHTML = staffFind();
    else if(view === "sessions") app.innerHTML = staffSessions();
    else if(view === "growth") app.innerHTML = staffGrowth();
    else app.innerHTML = staffOverview();
    return;
  }

  if(role === "PROVIDER"){
    if(view === "requests") app.innerHTML = providerRequests();
    else if(view === "availability") app.innerHTML = providerAvailability();
    else if(view === "profile") app.innerHTML = providerProfile();
    else app.innerHTML = providerOverview();
    return;
  }

  if(role === "HR_ADMIN"){
    if(view === "programmes") app.innerHTML = hrProgrammes();
    else if(view === "providers") app.innerHTML = hrProviders();
    else if(view === "growth") app.innerHTML = hrGrowth();
    else if(view === "bookings") app.innerHTML = hrBookings();
    else if(view === "availability") app.innerHTML = hrAvailability();
    else if(view === "categories") app.innerHTML = hrCategories();
    else if(view === "audit") app.innerHTML = hrAudit();
    else app.innerHTML = hrOverview();
    return;
  }

  app.innerHTML = `<main class="content"><div class="empty">No application role is assigned to this user.</div></main>`;
}

save();
render();
