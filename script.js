const STORAGE_KEY = "my-secretary-data";

function normalizeData(parsed) {
  return {
    tasks: parsed.tasks || [],
    schedule: parsed.schedule || [],
    notes: parsed.notes || [],
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: [], schedule: [], notes: [] };
    return normalizeData(JSON.parse(raw));
  } catch {
    return { tasks: [], schedule: [], notes: [] };
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const state = loadData();

function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 5) greeting = "夜遅くまでお疲れさまです。";
  else if (hour < 11) greeting = "おはようございます。今日も一日サポートします。";
  else if (hour < 17) greeting = "こんにちは。順調に進んでいますか?";
  else greeting = "こんばんは。今日一日お疲れさまでした。";
  document.getElementById("greeting").textContent = greeting;
}

function createListItem({ text, badge, done, onToggle, onDelete }) {
  const li = document.createElement("li");
  if (done) li.classList.add("done");

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
      onDelete: () => {
        state.schedule.splice(realIndex, 1);
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
    state.schedule.push({ time, text });
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

function isValidBackup(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  const { tasks = [], schedule = [], notes = [] } = parsed;
  if (!Array.isArray(tasks) || !Array.isArray(schedule) || !Array.isArray(notes)) {
    return false;
  }
  return (
    tasks.every((t) => t && typeof t.text === "string") &&
    schedule.every((s) => s && typeof s.time === "string" && typeof s.text === "string") &&
    notes.every((n) => typeof n === "string")
  );
}

function setBackupStatus(message) {
  document.getElementById("backup-status").textContent = message;
}

function exportData() {
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-secretary-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setBackupStatus("バックアップファイルを書き出しました。");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      setBackupStatus("ファイルを読み込めませんでした。JSON形式のバックアップを選んでください。");
      return;
    }
    if (!isValidBackup(parsed)) {
      setBackupStatus("My Secretary のバックアップファイルではないようです。");
      return;
    }
    if (!confirm("現在のデータはバックアップの内容で置き換えられます。よろしいですか?")) {
      return;
    }
    Object.assign(state, normalizeData(parsed));
    saveData(state);
    renderTasks();
    renderSchedule();
    renderNotes();
    setBackupStatus("バックアップからデータを復元しました。");
  };
  reader.onerror = () => {
    setBackupStatus("ファイルを読み込めませんでした。");
  };
  reader.readAsText(file);
}

function setupBackup() {
  const fileInput = document.getElementById("import-file");
  document.getElementById("export-button").addEventListener("click", exportData);
  document.getElementById("import-button").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) importData(file);
    fileInput.value = "";
  });
}

function init() {
  setGreeting();
  setupTaskForm();
  setupScheduleForm();
  setupNoteForm();
  setupBackup();
  renderTasks();
  renderSchedule();
  renderNotes();
}

document.addEventListener("DOMContentLoaded", init);
