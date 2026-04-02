// Popup script
document.addEventListener("DOMContentLoaded", () => {
  const tokenInput = document.getElementById("tokenInput");
  const modeSelect = document.getElementById("modeSelect");
  const sensitivitySelect = document.getElementById("sensitivitySelect");
  const frameRateSelect = document.getElementById("frameRateSelect");
  const saveBtn = document.getElementById("saveBtn");
  const deactivateBtn = document.getElementById("deactivateBtn");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const tokenSaved = document.getElementById("tokenSaved");

  // Load existing config
  chrome.storage.local.get(["aureonToken", "aureonEnabled", "settings"], (data) => {
    if (data.aureonToken) tokenInput.value = "••••••••••••••••";
    if (data.settings?.mode) modeSelect.value = data.settings.mode;
    if (data.settings?.sensitivity) sensitivitySelect.value = data.settings.sensitivity;
    if (data.settings?.frameRate) frameRateSelect.value = String(data.settings.frameRate);
    if (data.aureonEnabled) {
      statusDot.classList.add("active");
      statusText.textContent = "Active — watching tabs";
    }
  });

  saveBtn.onclick = () => {
    const token = tokenInput.value.trim();
    const settings = {
      mode: modeSelect.value,
      sensitivity: sensitivitySelect.value,
      frameRate: parseInt(frameRateSelect.value),
      quality: "medium",
    };

    const saveData = { settings, aureonEnabled: true };
    if (token && !token.startsWith("••")) {
      saveData.aureonToken = token;
    }

    chrome.storage.local.set(saveData, () => {
      tokenSaved.style.display = "block";
      statusDot.classList.add("active");
      statusText.textContent = "Active — watching tabs";
      setTimeout(() => { tokenSaved.style.display = "none"; }, 2000);
    });
  };

  deactivateBtn.onclick = () => {
    chrome.storage.local.set({ aureonEnabled: false }, () => {
      statusDot.classList.remove("active");
      statusText.textContent = "Inactive";
    });
  };
});
