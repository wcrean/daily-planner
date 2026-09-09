(() => {
  const greetingEl = document.getElementById('greeting');
  const dateEl = document.getElementById('dateLabel');
  const locationEl = document.getElementById('locationLabel');
  const locationButton = document.getElementById('locationButton');

  const fallbackLocation = 'Morristown, NJ';

  function getGreeting(hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function renderDateAndGreeting() {
    const now = new Date();
    greetingEl.textContent = `${getGreeting(now.getHours())}, Bill`;
    dateEl.textContent = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(now);
  }

  function requestLocation() {
    if (!('geolocation' in navigator)) {
      locationEl.textContent = fallbackLocation;
      locationButton.disabled = true;
      locationButton.title = 'Location is not supported in this browser';
      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = '…';
    locationButton.title = 'Requesting location';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        locationEl.textContent = `Current location · ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        locationButton.textContent = '✓';
        locationButton.title = 'Current location enabled';
      },
      () => {
        locationEl.textContent = fallbackLocation;
        locationButton.textContent = '⌖';
        locationButton.disabled = false;
        locationButton.title = 'Location unavailable — using Morristown';
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }

  renderDateAndGreeting();
  locationButton.addEventListener('click', requestLocation);
})();
