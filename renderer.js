const KEY = "taskforge-v2";
const defaultData = { tasks: [], projects: [{ id: "inbox", name: "Bandeja de entrada" }] };
let data = JSON.parse(localStorage.getItem(KEY) || "null") || defaultData;
if (!Array.isArray(data.tasks)) data.tasks = [];
if (!Array.isArray(data.projects) || !data.projects.length) data.projects = [{ id: "inbox", name: "Bandeja de entrada" }];
if (!data.projects.some(p => p.id === "inbox")) data.projects.unshift({ id: "inbox", name: "Bandeja de entrada" });
let view = "inbox", searchText = "", editingTaskId = null;
const $ = id => document.getElementById(id);

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
  if (window.taskforge) window.taskforge.syncTasks(data.tasks);
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function projectName(id) { return data.projects.find(p => p.id === id)?.name || "Bandeja de entrada"; }
function filtered() {
  let arr = data.tasks.filter(t => !t.deleted);
  if (view === "today") arr = arr.filter(t => t.date === today());
  else if (view === "upcoming") arr = arr.filter(t => t.date && t.date >= today());
  else if (view === "inbox") arr = arr.filter(t => (t.projectId || "inbox") === "inbox");
  else if (view.startsWith("project:")) arr = arr.filter(t => t.projectId === view.slice(8));
  if (view === "all") arr = data.tasks.filter(t => !t.deleted);
  if (searchText) arr = arr.filter(t => String(t.title || "").toLowerCase().includes(searchText.toLowerCase()));
  const rank = { p1: 0, p2: 1, p3: 2, none: 3 };
  return arr.sort((a,b) => Number(a.completed)-Number(b.completed) || ((rank[a.priority] ?? 3)-(rank[b.priority] ?? 3)) || (a.date||"9999").localeCompare(b.date||"9999"));
}
function render() {
  $("projects").innerHTML = data.projects.filter(p => p.id !== "inbox").map(p => `<div class="project ${view === "project:"+p.id ? "active" : ""}" data-project="${esc(p.id)}"># ${esc(p.name)}</div>`).join("");
  document.querySelectorAll(".nav").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  const titles = { inbox: ["Bandeja de entrada", ""], today: ["Hoy", new Date().toLocaleDateString("es-ES", {weekday:"long",day:"numeric",month:"long"})], upcoming: ["Próximas", "Tareas con fecha a partir de hoy"], all: ["Todas", ""] };
  $("viewTitle").textContent = view.startsWith("project:") ? projectName(view.slice(8)) : (titles[view]?.[0] || "Todas");
  $("viewSubtitle").textContent = view.startsWith("project:") ? "Proyecto" : (titles[view]?.[1] || "");
  const arr = filtered();
  $("empty").classList.toggle("hidden", arr.length > 0);
  $("taskList").innerHTML = arr.map(t => `<div class="task ${t.completed ? "done" : ""}">
    <button class="check ${t.completed ? "done" : ""}" data-check="${esc(t.id)}" aria-label="Completar tarea" title="Completar"></button>
    <div class="task-main"><div class="task-title">${esc(t.title)}</div><div class="meta">
      <span class="${esc(t.priority || "none")}">${priorityLabel(t.priority)}</span><span>${t.date ? formatDate(t.date) : ""}${t.time ? " · " + esc(t.time) : ""}</span><span>${esc(projectName(t.projectId))}</span></div></div>
    <button class="edit" data-edit="${esc(t.id)}" title="Editar tarea" aria-label="Editar tarea">✎</button>
    <button class="delete" data-delete="${esc(t.id)}" title="Eliminar tarea" aria-label="Eliminar tarea">×</button></div>`).join("");
  $("inboxCount").textContent = data.tasks.filter(t => !t.completed && !t.deleted && (t.projectId || "inbox") === "inbox").length || "";
  $("todayCount").textContent = data.tasks.filter(t => !t.completed && !t.deleted && t.date === today()).length || "";
  const projectSelect = $("taskProject");
  const current = projectSelect.value;
  projectSelect.innerHTML = data.projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
  if (data.projects.some(p => p.id === current)) projectSelect.value = current;
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
function priorityLabel(p) { return ({p1:"🔴 P1",p2:"🟠 P2",p3:"🔵 P3",none:"Sin prioridad"})[p || "none"] || "Sin prioridad"; }
function formatDate(d) { return new Date(d + "T00:00:00").toLocaleDateString("es-ES", {day:"numeric",month:"short"}); }
function openComposer(task = null) {
  editingTaskId = task?.id || null;
  $("taskFormTitle").textContent = task ? "Editar tarea" : "Nueva tarea";
  $("saveTask").textContent = task ? "Guardar cambios" : "Añadir";
  $("taskTitle").value = task?.title || "";
  $("taskPriority").value = task?.priority || "none";
  $("taskDate").value = task?.date || "";
  $("taskTime").value = task?.time || "";
  $("taskProject").value = task?.projectId || (view.startsWith("project:") ? view.slice(8) : "inbox");
  $("taskForm").classList.remove("hidden");
  $("taskTitle").focus();
}
function closeComposer() { $("taskForm").reset(); $("taskForm").classList.add("hidden"); editingTaskId = null; }
function openProjectDialog() { $("projectName").value = ""; $("projectDialog").classList.remove("hidden"); $("projectName").focus(); }
function closeProjectDialog() { $("projectDialog").classList.add("hidden"); $("projectForm").reset(); }

$("newTask").onclick = () => openComposer();
$("cancelTask").onclick = closeComposer;
$("taskForm").onsubmit = e => {
  e.preventDefault();
  const title = $("taskTitle").value.trim();
  if (!title) return;
  const values = { title, priority: $("taskPriority").value, date: $("taskDate").value, time: $("taskTime").value, projectId: $("taskProject").value || "inbox" };
  if (editingTaskId) {
    const task = data.tasks.find(t => t.id === editingTaskId);
    if (task) Object.assign(task, values);
  } else {
    data.tasks.push({ id: uid(), ...values, completed: false, deleted: false });
  }
  save(); closeComposer(); render();
};
document.querySelectorAll(".nav").forEach(n => n.onclick = () => { view = n.dataset.view; render(); });
$("search").oninput = e => { searchText = e.target.value; render(); };
$("addProject").onclick = openProjectDialog;
$("cancelProject").onclick = closeProjectDialog;
$("projectDialogClose").onclick = closeProjectDialog;
$("projectForm").onsubmit = e => {
  e.preventDefault();
  const name = $("projectName").value.trim();
  if (!name) return;
  if (data.projects.some(p => p.id !== "inbox" && p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    $("projectError").textContent = "Ya existe un proyecto con ese nombre.";
    $("projectError").classList.remove("hidden");
    return;
  }
  data.projects.push({ id: uid(), name });
  save(); closeProjectDialog(); view = "project:" + data.projects[data.projects.length - 1].id; render();
};
$("projectName").oninput = () => { $("projectError").classList.add("hidden"); };
$("projects").onclick = e => { const p = e.target.closest("[data-project]"); if (p) { view = "project:" + p.dataset.project; render(); } };
$("taskList").onclick = e => {
  const c = e.target.closest("[data-check]"), d = e.target.closest("[data-delete]"), edit = e.target.closest("[data-edit]");
  if (c) { const t = data.tasks.find(x => x.id === c.dataset.check); if (t) { t.completed = !t.completed; save(); render(); } }
  if (d) { data.tasks = data.tasks.filter(x => x.id !== d.dataset.delete); save(); render(); }
  if (edit) { const t = data.tasks.find(x => x.id === edit.dataset.edit); if (t) openComposer(t); }
};
$("projectDialog").addEventListener("click", e => { if (e.target === $("projectDialog")) closeProjectDialog(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeProjectDialog(); if (!$("taskForm").classList.contains("hidden")) closeComposer(); } });
render();
if (window.taskforge) window.taskforge.syncTasks(data.tasks);
