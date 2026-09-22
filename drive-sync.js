(function () {
  const CLIENT_ID_KEY = "my-secretary-google-client-id";
  const DRIVE_FILE_NAME = "my-secretary-data.json";
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata";

  let tokenClient = null;
  let accessToken = null;
  let driveFileId = null;

  function $(id) {
    return document.getElementById(id);
  }

  function getClientId() {
    return localStorage.getItem(CLIENT_ID_KEY) || "";
  }

  function setClientId(id) {
    localStorage.setItem(CLIENT_ID_KEY, id);
  }

  function setStatus(message, isError) {
    const el = $("sync-message");
    el.textContent = message;
    el.classList.toggle("badge-off", !!isError);
    el.classList.toggle("badge-on", !isError && !!message);
  }

  function renderSyncUI() {
    const hasClientId = !!getClientId();
    $("sync-setup").style.display = hasClientId ? "none" : "block";
    $("sync-controls").style.display = hasClientId ? "block" : "none";
    if (!hasClientId) return;
    $("sync-signin-btn").style.display = accessToken ? "none" : "inline-block";
    $("sync-actions").style.display = accessToken ? "flex" : "none";
  }

  function ensureTokenClient() {
    const clientId = getClientId();
    if (!clientId || typeof google === "undefined" || !google.accounts) return null;
    if (tokenClient && tokenClient.__clientId === clientId) return tokenClient;
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: () => {},
    });
    tokenClient.__clientId = clientId;
    return tokenClient;
  }

  function signIn() {
    const client = ensureTokenClient();
    if (!client) {
      setStatus("Googleログインの準備ができていません。しばらく待ってから再試行してください。", true);
      return;
    }
    client.callback = (resp) => {
      if (resp.error) {
        setStatus("ログインに失敗しました: " + resp.error, true);
        return;
      }
      accessToken = resp.access_token;
      driveFileId = null;
      setStatus("ログインしました。");
      renderSyncUI();
    };
    client.requestAccessToken({ prompt: "" });
  }

  function signOut() {
    if (accessToken && typeof google !== "undefined" && google.accounts) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    driveFileId = null;
    setStatus("ログアウトしました。");
    renderSyncUI();
  }

  async function findFileId() {
    const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}'`);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id)&q=${query}`,
      { headers: { Authorization: "Bearer " + accessToken } }
    );
    if (!res.ok) throw new Error("ファイル検索に失敗しました (HTTP " + res.status + ")");
    const data = await res.json();
    return data.files && data.files[0] ? data.files[0].id : null;
  }

  async function uploadToDrive() {
    if (!accessToken) {
      signIn();
      return;
    }
    setStatus("アップロード中...");
    try {
      const fileId = driveFileId || (await findFileId());
      const json = window.MySecretary.getStateJSON();

      if (fileId) {
        const res = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: "PATCH",
            headers: {
              Authorization: "Bearer " + accessToken,
              "Content-Type": "application/json",
            },
            body: json,
          }
        );
        if (!res.ok) throw new Error("アップロードに失敗しました (HTTP " + res.status + ")");
        driveFileId = fileId;
      } else {
        const boundary = "my-secretary-sync-boundary";
        const metadata = { name: DRIVE_FILE_NAME, parents: ["appDataFolder"] };
        const body =
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
          JSON.stringify(metadata) +
          `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
          json +
          `\r\n--${boundary}--`;
        const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + accessToken,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        });
        if (!res.ok) throw new Error("アップロードに失敗しました (HTTP " + res.status + ")");
        const data = await res.json();
        driveFileId = data.id;
      }
      setStatus("アップロード完了(" + new Date().toLocaleString("ja-JP") + ")");
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function downloadFromDrive() {
    if (!accessToken) {
      signIn();
      return;
    }
    setStatus("ダウンロード中...");
    try {
      const fileId = driveFileId || (await findFileId());
      if (!fileId) {
        setStatus("Drive上にデータが見つかりません。先に「アップロード」を実行してください。", true);
        return;
      }
      driveFileId = fileId;
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: "Bearer " + accessToken },
      });
      if (!res.ok) throw new Error("ダウンロードに失敗しました (HTTP " + res.status + ")");
      const json = await res.text();
      window.MySecretary.replaceState(json);
      setStatus("ダウンロード完了(" + new Date().toLocaleString("ja-JP") + ")");
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function init() {
    $("sync-clientid-input").value = getClientId();

    $("sync-clientid-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const value = $("sync-clientid-input").value.trim();
      if (!value) return;
      setClientId(value);
      tokenClient = null;
      renderSyncUI();
      setStatus("Client ID を保存しました。続けて「Googleでログイン」してください。");
    });

    $("sync-signin-btn").addEventListener("click", signIn);
    $("sync-signout-btn").addEventListener("click", signOut);
    $("sync-upload-btn").addEventListener("click", uploadToDrive);
    $("sync-download-btn").addEventListener("click", downloadFromDrive);

    renderSyncUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
