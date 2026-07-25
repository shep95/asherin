// Popup script — never reads or writes the token directly; all token ops go
// through the background service worker which encrypts at rest.
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

  // Load existing config via background (token never leaves the service worker)
  chrome.runtime.sendMessage({ type: "getConfig" }, (data) => {
    if (!data) return;
    if (data.hasToken) tokenInput.placeholder = "Token stored (re-enter to replace)";
    if (data.settings?.mode) modeSelect.value = data.settings.mode;
    if (data.settings?.sensitivity) sensitivitySelect.value = data.settings.sensitivity;
    if (data.settings?.frameRate) frameRateSelect.value = String(data.settings.frameRate);
    if (data.asherinEnabled && data.hasToken) {
      statusDot.classList.add("active");
      statusText.textContent = "Active — watching tabs";
    } else if (!data.hasToken) {
      statusText.textContent = "Locked — token required";
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

    const payload = { settings, asherinEnabled: true };
    if (token) payload.asherinToken = token;

    chrome.runtime.sendMessage({ type: "saveConfig", data: payload }, () => {
      tokenInput.value = "";
      tokenSaved.style.display = "block";
      statusDot.classList.add("active");
      statusText.textContent = "Active — watching tabs";
      setTimeout(() => { tokenSaved.style.display = "none"; }, 2000);
    });
  };

  deactivateBtn.onclick = () => {
    chrome.runtime.sendMessage(
      { type: "saveConfig", data: { asherinEnabled: false } },
      () => {
        statusDot.classList.remove("active");
        statusText.textContent = "Inactive";
      }
    );
  };
});
