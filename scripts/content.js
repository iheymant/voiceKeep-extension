const transcript = [];
const speakerState = {};
const saveTimeouts = new Map();
let hasUnsavedChanges = false;
let observer = null;

const currentMeeting = {
  id: crypto.randomUUID(),
  displayId: generateVoiceKeepMeetingId(),
  createdAt: Date.now(),
  documentTitle: generateDocumentTitle(),
  meetingUrl: location.href,
  participants: [],
  transcript: transcript,
};

function generateVoiceKeepMeetingId() {
  const now = new Date();
  const meetingCode = location.pathname.replace("/", "");

  // Date parts
  const day = now.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = now.toLocaleDateString("en-GB", { month: "short" }); // May
  const year = now.getFullYear();

  // Time parts
  const time = now
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(":", "h")
    .replace(" ", ""); // 03h45PM

  // Short unique suffix
  const uid = Math.random().toString(36).slice(2, 7).toUpperCase(); // K9XTW

  const displayId = `VoiceKeep_${meetingCode}_${day}-${month}-${year}_${time}_${uid}`;
  return displayId;
}

function generateDocumentTitle() {
  const date = new Date();
  const meetingCode = location.pathname.split("/").filter(Boolean).pop();
  const dateStr = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }); // 16 May 2026
  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }); // 03:45 PM

  const documentTitle = `VoiceKeep • ${meetingCode} • ${dateStr} • ${timeStr}`;
  return documentTitle;
}

async function saveMeeting() {
  if (!hasUnsavedChanges) return;

  const data = await chrome.storage.local.get("meetings");

  const meetings = data.meetings || [];

  const existingIndex = meetings.findIndex(
    (meeting) => meeting.id === currentMeeting.id,
  );

  if (existingIndex >= 0) {
    meetings[existingIndex] = currentMeeting;
  } else {
    meetings.unshift(currentMeeting);
  }

  // keep latest 25 meetings only

  if (meetings.length > 25) {
    meetings.length = 25;
  }

  await chrome.storage.local.set({
    meetings,
  });
  hasUnsavedChanges = false;
}

function addTranscript(speaker, text) {
  if (!text) return;

  transcript.push({
    speaker,
    text,
    time: new Date().toLocaleTimeString(),
  });

  // add participant

  if (!currentMeeting.participants.includes(speaker)) {
    currentMeeting.participants.push(speaker);
  }
}

// autosave every 10 sec

setInterval(() => {
  if (hasUnsavedChanges) {
    saveMeeting();
  }
}, 10000);

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function extractCaptions() {
  const region = document.querySelector('[aria-label="Captions"]');

  if (!region) return [];

  const entries = [...region.children]
    .filter((el) => getComputedStyle(el).display !== "none")
    .filter((el) => el.innerText.trim().length > 0)
    .filter(
      (el) =>
        !el.querySelector('[aria-label="Jump to the most recent captions"]'),
    );

  return entries.map((entry) => {
    const children = [...entry.children];

    return {
      speaker: cleanText(children[0]?.innerText || "Unknown"),

      text: cleanText(children[1]?.innerText || ""),
    };
  });
}

function saveTranscript(speaker, text) {
  if (!text) return;

  transcript.push({
    speaker,
    text,
    time: new Date().toLocaleTimeString(),
  });
  if (!currentMeeting.participants.includes(speaker)) {
    currentMeeting.participants.push(speaker);
  }

  hasUnsavedChanges = true;
}

function captionsAreEnabled() {
  return !!document.querySelector('[aria-label="Turn off captions"]');
}

function processCaptions() {
  if (!captionsAreEnabled()) {
    return;
  }

  const captions = extractCaptions();

  captions.forEach((caption) => {
    if (!speakerState[caption.speaker]) {
      speakerState[caption.speaker] = {
        finalizedText: "",
      };
    }

    clearTimeout(saveTimeouts.get(caption.speaker));

    saveTimeouts.set(
      caption.speaker,

      setTimeout(() => {
        const state = speakerState[caption.speaker];

        const currentText = caption.text;

        const oldText = state.finalizedText;

        if (currentText === oldText) {
          return;
        }

        let newPart = currentText;

        if (currentText.startsWith(oldText)) {
          newPart = cleanText(currentText.slice(oldText.length));
        }

        if (!newPart) return;

        saveTranscript(caption.speaker, newPart);

        state.finalizedText = currentText;
      }, 1200),
    );
  });
}

function manageObserver() {
  const region = document.querySelector('[aria-label="Captions"]');

  // captions closed

  if (!region && observer) {
    observer.disconnect();

    observer = null;

    return;
  }

  // captions opened again

  if (region && !observer) {
    observer = new MutationObserver(() => {
      processCaptions();
    });

    observer.observe(region, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

setInterval(manageObserver, 2000);

window.addEventListener(
  "beforeunload",

  () => {
    saveMeeting();
  },
);

document.addEventListener(
  "visibilitychange",

  () => {
    if (document.hidden) {
      saveMeeting();
    }
  },
);
