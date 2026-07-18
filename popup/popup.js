const descriptionEl = document.querySelector(".history-extra-info");
const downloadLatestBtn = document.querySelector("#download-latest-btn");
const historyBtn = document.querySelector("#toggle-history-btn");
const historyContainer = document.querySelector(".history-container");
const historyMeta = document.querySelector(".history-meta");

let historyVisible = false;

async function getMeetings() {
  try {
    const data = await chrome.storage.local.get("meetings");
    return Array.isArray(data.meetings) ? data.meetings : [];
  } catch (err) {
    console.error("[VoiceKeep] Storage read failed:", err);
    return [];
  }
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFilename(name) {
  return (
    String(name ?? "transcript")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .trim() || "transcript"
  );
}

function formatTime(raw) {
  if (!raw) return "";
  try {
    const iso = new Date(`1970-01-01T${raw}`);
    if (!isNaN(iso)) {
      return iso.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
    const full = new Date(raw);
    if (!isNaN(full)) {
      return full.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }
  } catch {}
  return String(raw);
}

function getInitials(speaker) {
  return (
    String(speaker ?? "")
      .trim()
      .split(/\s+/)
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function showExtraInfo(message) {
  if (descriptionEl) descriptionEl.innerText = message;
}

function renderMeetingCard(meeting) {
  const fragment = document.createDocumentFragment();

  const card = document.createElement("div");
  card.className = "meeting-card";

  const titleEl = document.createElement("h3");
  titleEl.className = "meeting-id";
  titleEl.textContent = meeting.documentTitle || "Unknown Meeting";

  const participantCount = meeting.participants?.length ?? 0;
  const participantsEl = document.createElement("p");
  participantsEl.className = "participants-count";
  participantsEl.textContent =
    `${participantCount} participant${participantCount === 1 ? "" : "s"} ` +
    `${participantCount === 1 ? "was" : "were"} speaking.`;

  const messageCount = meeting.transcript?.length ?? 0;
  const messagesEl = document.createElement("p");
  messagesEl.className = "messages-count";
  messagesEl.textContent =
    `${messageCount} message${messageCount === 1 ? "" : "s"} ` +
    `${messageCount === 1 ? "was" : "were"} made.`;

  const btn = document.createElement("button");
  btn.className = "download-btn";
  btn.dataset.id = meeting.id ?? "";
  btn.textContent = "Download Transcript";

  card.append(titleEl, participantsEl, messagesEl, btn);
  fragment.appendChild(card);
  fragment.appendChild(document.createElement("hr"));

  return fragment;
}

function renderHistoryList(meetings) {
  historyContainer.innerHTML = "";
  const fragment = document.createDocumentFragment();
  meetings.forEach((meeting) =>
    fragment.appendChild(renderMeetingCard(meeting)),
  );
  historyContainer.appendChild(fragment);
}

function renderHistoryMeta(meetings) {
  if (!historyMeta) return;

  if (!historyVisible) {
    historyMeta.style.display = "none";
    return;
  }

  historyMeta.style.display = "block";
  historyMeta.innerHTML = `
    <span class="voiceKeep-recorded-length-discription">${escapeHTML(meetings.length)} saved meetings</span>
    <span class="voickeep-recorded-limit-discription">VoiceKeep stores the latest 25 sessions locally.
      <span class="voiceKeep-limit-alert">
        Export important sessions before they expire.
      </span>
    </span>
  `;
}

function generateTranscriptHTML(meeting) {
  const title = escapeHTML(meeting.documentTitle ?? "Unknown Meeting");
  const displayId = escapeHTML(meeting.displayId ?? "N/A");
  const participants = meeting.participants?.length ?? 0;
  const transcript = Array.isArray(meeting.transcript)
    ? meeting.transcript
    : [];

  const dateStr = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const messagesHTML = transcript
    .map((entry, i) => {
      const initials = getInitials(entry?.speaker);
      const avatarClass = `av-${i % 6}`;
      const time = formatTime(entry?.time ?? "");
      const safeText = escapeHTML(entry?.text ?? "(no content)");
      const safeSpeaker = escapeHTML(entry?.speaker ?? "Unknown");

      return `
          <div class="message">
            <div class="avatar ${avatarClass}">${initials}</div>
            <div class="msg-header">
              <span class="name">${safeSpeaker}</span>
              <span class="time">${time}</span>
            </div>
            <p class="text">${safeText}</p>
          </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>VoiceKeep — ${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { scroll-behavior: smooth; }

    body {
      font-family: 'Bricolage Grotesque', sans-serif;
      background: #F7F7F5;
      color: #1A1A1A;
      padding: 48px 24px;
      -webkit-font-smoothing: antialiased;
      min-height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .page { max-width: 720px; width: 100%; margin: 0 auto; }

    .header {
      background: #1A1A1A;
      border-radius: 16px;
      padding: 32px 36px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .brand { font-size: 22px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.02em; }

    .beta-badge {
      font-size: 11px; font-weight: 600; color: #A78BFA;
      background: rgba(167,139,250,0.15); padding: 4px 12px;
      border-radius: 99px; letter-spacing: 0.06em;
      text-transform: uppercase; white-space: nowrap;
    }

    .meeting-title {
      font-size: clamp(18px, 4vw, 28px);
      font-weight: 700; color: #FFFFFF;
      letter-spacing: -0.02em; line-height: 1.2;
      word-break: break-word; overflow-wrap: anywhere;
    }

    .header-meta { display: flex; gap: 16px; flex-wrap: wrap; }

    .meta-pill {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 500; color: #9CA3AF; white-space: nowrap;
    }

    .meta-pill svg { opacity: 0.6; flex-shrink: 0; }

    .id-bar {
      background: #FFFFFF; border: 1px solid #E5E5E2; border-radius: 10px;
      padding: 12px 20px; margin-bottom: 28px;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 8px;
    }

    .id-label {
      font-size: 11px; font-weight: 600; color: #9CA3AF;
      text-transform: uppercase; letter-spacing: 0.07em; white-space: nowrap;
    }

    .id-value {
      font-size: 12px; font-weight: 600; color: #1A1A1A;
      letter-spacing: 0.02em; font-variant-numeric: tabular-nums; word-break: break-all;
    }

    .transcript-label {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: #9CA3AF; margin-bottom: 12px;
    }

    .transcript-scroll {
      max-height: 72vh;
      overflow-y: auto; overflow-x: hidden;
      border-radius: 14px; padding-right: 4px; scroll-behavior: smooth;
      scrollbar-width: thin; scrollbar-color: #D1D5DB #F7F7F5;
    }

    .transcript-scroll::-webkit-scrollbar       { width: 5px; }
    .transcript-scroll::-webkit-scrollbar-track  { background: #F7F7F5; border-radius: 99px; }
    .transcript-scroll::-webkit-scrollbar-thumb  { background: #D1D5DB; border-radius: 99px; }
    .transcript-scroll::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

    .transcript { display: flex; flex-direction: column; gap: 8px; }

    .message {
      background: #FFFFFF; border: 1px solid #E5E5E2; border-radius: 14px;
      padding: 16px 20px;
      display: grid; grid-template-columns: 36px 1fr;
      grid-template-rows: auto auto; column-gap: 14px; row-gap: 6px; min-width: 0;
    }

    .avatar {
      grid-row: 1 / 3; width: 36px; height: 36px; min-width: 36px;
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; align-self: start; margin-top: 1px;
    }

    .av-0 { background: #EDE9FE; color: #5B21B6; }
    .av-1 { background: #DCFCE7; color: #166534; }
    .av-2 { background: #FEF3C7; color: #92400E; }
    .av-3 { background: #FCE7F3; color: #9D174D; }
    .av-4 { background: #DBEAFE; color: #1E40AF; }
    .av-5 { background: #F3F4F6; color: #374151; }

    .msg-header {
      display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; min-width: 0;
    }

    .name {
      font-size: 14px; font-weight: 700; color: #1A1A1A;
      letter-spacing: -0.01em; word-break: break-word; overflow-wrap: anywhere;
    }

    .time { font-size: 11px; font-weight: 500; color: #9CA3AF; white-space: nowrap; flex-shrink: 0; }

    .text {
      font-size: 14px; font-weight: 400; color: #374151; line-height: 1.65;
      grid-column: 2; min-width: 0;
      word-break: break-word; overflow-wrap: anywhere; white-space: pre-wrap;
    }

    .footer {
      margin-top: 36px; padding-top: 20px; border-top: 1px solid #E5E5E2;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 8px;
    }

    .footer-brand { font-size: 13px; font-weight: 700; color: #1A1A1A; }
    .footer-note  { font-size: 12px; color: #9CA3AF; }

    @media print {
      body { background: white; padding: 24px; }
      .transcript-scroll { max-height: none; overflow: visible; }
      .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .avatar  { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>

<body>
  <div class="page">

    <div class="header">
      <div class="header-top">
        <span class="brand">VoiceKeep</span>
        <span class="beta-badge">Beta</span>
      </div>
      <h1 class="meeting-title">${title}</h1>
      <div class="header-meta">
        <span class="meta-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ${participants} participants
        </span>
        <span class="meta-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${dateStr}
        </span>
        <span class="meta-pill">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${timeStr}
        </span>
      </div>
    </div>

    <div class="id-bar">
      <span class="id-label">File ID</span>
      <span class="id-value">${displayId}</span>
    </div>

    <p class="transcript-label">Transcript — ${transcript.length} messages</p>

    <div class="transcript-scroll">
      <div class="transcript">
        ${messagesHTML}
      </div>
    </div>

    <div class="footer">
      <span class="footer-brand">VoiceKeep</span>
      <span class="footer-note">Generated on ${dateStr} · VoiceKeep Extension</span>
    </div>

  </div>
</body>
</html>`;
}

function downloadHTMLTranscript(meeting) {
  const html = generateTranscriptHTML(meeting);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFilename(meeting.displayId)}.html`;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleDownloadLatest() {
  const meetings = await getMeetings();
  if (meetings.length === 0) {
    showExtraInfo("No meetings found");
    return;
  }
  downloadHTMLTranscript(meetings[0]);
}

async function handleToggleHistory() {
  historyVisible = !historyVisible;

  historyContainer.hidden = !historyVisible;
  historyBtn.textContent = historyVisible
    ? "Hide Transcript History"
    : "Show Transcript History";

  if (!historyVisible) {
    historyContainer.classList.remove("active");
    renderHistoryMeta([]);
    return;
  }

  const meetings = await getMeetings();

  if (meetings.length === 0) {
    showExtraInfo("No sessions yet. Start a meeting with captions enabled and VoiceKeep will begin saving transcripts automatically.");
    historyContainer.classList.remove("active");
    renderHistoryMeta([]);
    return;
  }

  historyContainer.classList.add("active");
  renderHistoryList(meetings);
  renderHistoryMeta(meetings);
}

async function handleHistoryDownload(e) {
  const button = e.target.closest(".download-btn");
  if (!button) return;

  const meetingId = button.dataset.id;
  if (!meetingId) return;

  const meetings = await getMeetings();
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return;

  downloadHTMLTranscript(meeting);
}

downloadLatestBtn?.addEventListener("click", handleDownloadLatest);
historyBtn?.addEventListener("click", handleToggleHistory);
historyContainer?.addEventListener("click", handleHistoryDownload);
