(() => {
  const config = document.currentScript;
  if (!config || location.hostname !== config.dataset.hostname) return;
  const beacon = document.createElement("script");
  beacon.src = "https://static.cloudflareinsights.com/beacon.min.js";
  beacon.type = "module";
  beacon.dataset.cfBeacon = JSON.stringify({ token: config.dataset.token, spa: true });
  document.body.appendChild(beacon);
})();
