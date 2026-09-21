const STORAGE_KEY = "my-secretary-data";
const REMINDER_CHECK_INTERVAL_MS = 20000;

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], schedule: [], notes: [] };
    const parsed = JSON.parse(raw);
    const schedule = (parsed.schedule || []).map((item) => ({
      id: item.id || generateId(),
      time: item.time,
      text: item.text,
      notifiedOn: item.notifiedOn || null,
    }));
    return {
      tasks: parsed.tasks || [],
      schedule,
      notes: parsed.notes || [],
    };
  } catch {
    return { tasks: [], schedule: [], notes: [] };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const state = loadData();
const dueIds = new Set();

function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 5) greeting = "夜遅くまでお疲れさまです。";
  else if (hour < 11) greeting = "おはようございます。今日も一日サポートします。";
  else if (hour < 17) greeting = "こんにちは。順調に進んでいますか?";
  else greeting = "こんばんは。今日一日お疲れさまでした。";
  document.getElementById("greeting").textContent = greeting;
}

function createListItem({ text, badge, done, due, onToggle, onDelete }) {
  const li = document.createElement("li");
  if (done) li.classList.add("done");
  if (due) li.classList.add("due");

  if (onToggle) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !!done;
    checkbox.addEventListener("change", onToggle);
    li.appendChild(checkbox);
  }

  if (badge) {
    const badgeEl = document.createElement("span");
    badgeEl.className = "time-badge";
    badgeEl.textContent = badge;
    li.appendChild(badgeEl);
  }

  const textEl = document.createElement("span");
  textEl.className = "item-text";
  textEl.textContent = text;
  li.appendChild(textEl);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete";
  deleteBtn.textContent = "削除";
  deleteBtn.addEventListener("click", onDelete);
  li.appendChild(deleteBtn);

  return li;
}

function renderEmptyHint(listEl, message) {
  const li = document.createElement("li");
  li.className = "empty-hint";
  li.textContent = message;
  listEl.appendChild(li);
}

function renderTasks() {
  const listEl = document.getElementById("task-list");
  listEl.innerHTML = "";
  if (state.tasks.length === 0) {
    renderEmptyHint(listEl, "タスクはまだありません。");
    return;
  }
  state.tasks.forEach((task, index) => {
    const li = createListItem({
      text: task.text,
      done: task.done,
      onToggle: () => {
        state.tasks[index].done = !state.tasks[index].done;
        saveData(state);
        renderTasks();
      },
      onDelete: () => {
        state.tasks.splice(index, 1);
        saveData(state);
        renderTasks();
      },
    });
    listEl.appendChild(li);
  });
}

function renderSchedule() {
  const listEl = document.getElementById("schedule-list");
  listEl.innerHTML = "";
  if (state.schedule.length === 0) {
    renderEmptyHint(listEl, "予定はまだありません。");
    return;
  }
  const sorted = [...state.schedule].sort((a, b) => a.time.localeCompare(b.time));
  sorted.forEach((item) => {
    const realIndex = state.schedule.indexOf(item);
    const li = createListItem({
      text: item.text,
      badge: item.time,
      due: dueIds.has(item.id),
      onDelete: () => {
        state.schedule.splice(realIndex, 1);
        dueIds.delete(item.id);
        saveData(state);
        renderSchedule();
      },
    });
    listEl.appendChild(li);
  });
}

function renderNotes() {
  const listEl = document.getElementById("note-list");
  listEl.innerHTML = "";
  if (state.notes.length === 0) {
    renderEmptyHint(listEl, "メモはまだありません。");
    return;
  }
  state.notes.forEach((note, index) => {
    const li = createListItem({
      text: note,
      onDelete: () => {
        state.notes.splice(index, 1);
        saveData(state);
        renderNotes();
      },
    });
    listEl.appendChild(li);
  });
}

function setupTaskForm() {
  const form = document.getElementById("task-form");
  const input = document.getElementById("task-input");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    state.tasks.push({ text, done: false });
    saveData(state);
    input.value = "";
    renderTasks();
  });
}

function setupScheduleForm() {
  const form = document.getElementById("schedule-form");
  const timeInput = document.getElementById("schedule-time");
  const textInput = document.getElementById("schedule-input");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const time = timeInput.value;
    const text = textInput.value.trim();
    if (!time || !text) return;
    state.schedule.push({ id: generateId(), time, text, notifiedOn: null });
    saveData(state);
    timeInput.value = "";
    textInput.value = "";
    renderSchedule();
  });
}

function setupNoteForm() {
  const form = document.getElementById("note-form");
  const input = document.getElementById("note-input");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    state.notes.push(text);
    saveData(state);
    input.value = "";
    renderNotes();
  });
}

function isNotificationSupported() {
  return typeof Notification !== "undefined";
}

function renderNotificationStatus() {
  const el = document.getElementById("notification-status");
  if (!isNotificationSupported()) {
    el.textContent = "このブラウザは通知に対応していません。";
    return;
  }
  el.innerHTML = "";
  const permission = Notification.permission;
  if (permission === "granted") {
    const span = document.createElement("span");
    span.className = "badge-on";
    span.textContent = "🔔 通知は有効です";
    el.appendChild(span);
  } else if (permission === "denied") {
    const span = document.createElement("span");
    span.className = "badge-off";
    span.textContent = "🔕 通知がブロックされています(ブラウザ設定から許可してください)";
    el.appendChild(span);
  } else {
    const span = document.createElement("span");
    span.textContent = "予定の時刻に通知でお知らせできます。";
    el.appendChild(span);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "通知を有効にする";
    btn.addEventListener("click", async () => {
      await Notification.requestPermission();
      renderNotificationStatus();
    });
    el.appendChild(btn);
  }
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLocalTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function notifyReminder(item) {
  if (isNotificationSupported() && Notification.permission === "granted") {
    new Notification("リマインダー", { body: item.text, tag: item.id });
  }
  dueIds.add(item.id);
  renderSchedule();
  setTimeout(() => {
    dueIds.delete(item.id);
    renderSchedule();
  }, 60000);
}

function checkReminders() {
  const now = new Date();
  const today = formatLocalDate(now);
  const nowHHMM = formatLocalTime(now);
  let changed = false;
  state.schedule.forEach((item) => {
    if (item.time === nowHHMM && item.notifiedOn !== today) {
      item.notifiedOn = today;
      changed = true;
      notifyReminder(item);
    }
  });
  if (changed) saveData(state);
}

function init() {
  setGreeting();
  setupTaskForm();
  setupScheduleForm();
  setupNoteForm();
  renderTasks();
  renderSchedule();
  renderNotes();
  renderNotificationStatus();
  checkReminders();
  setInterval(checkReminders, REMINDER_CHECK_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", init);
