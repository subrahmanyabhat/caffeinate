// Runs inside the offscreen document. navigator.getBattery() is not
// available in service workers, so we monitor charging state here and
// report changes back to the background worker.

(async () => {
  try {
    const battery = await navigator.getBattery();

    const report = () => {
      chrome.runtime.sendMessage({ type: 'battery', charging: battery.charging });
    };

    report(); // initial state
    battery.addEventListener('chargingchange', report);
  } catch (e) {
    // If the Battery API is unavailable, assume charging so -w doesn't
    // silently keep the screen off.
    chrome.runtime.sendMessage({ type: 'battery', charging: true });
  }
})();
