(() => {
  const greetingEl = document.getElementById('greeting');
  const dateEl = document.getElementById('dateLabel');
  const locationEl = document.getElementById('locationLabel');
  const locationButton = document.getElementById('locationButton');

  const fallbackLocation = 'Morristown, NJ';
  // After deploying the Cloudflare Worker, paste its /agenda URL here.
  const CALENDAR_API_URL = '';
  const agendaList = document.getElementById('agendaList');
  const agendaStatus = document.getElementById('agendaStatus');

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


  function sameLocalDate(date, target = new Date()) {
    return date.getFullYear() === target.getFullYear()
      && date.getMonth() === target.getMonth()
      && date.getDate() === target.getDate();
  }

  function parseEventStart(event) {
    if (event.start?.allDay && event.start.date) return new Date(`${event.start.date}T12:00:00`);
    if (event.start?.dateTime) return new Date(event.start.dateTime);
    return null;
  }

  function formatTime(date) {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function renderAgenda(events) {
    const todayEvents = events.filter((event) => {
      const start = parseEventStart(event);
      return start && sameLocalDate(start);
    });

    if (!todayEvents.length) {
      agendaList.innerHTML = '<div class="empty-state">No events scheduled today.</div>';
      return;
    }

    agendaList.innerHTML = todayEvents.map((event) => {
      const start = parseEventStart(event);
      const end = event.end?.dateTime ? new Date(event.end.dateTime) : null;
      const time = event.start?.allDay ? 'All day' : formatTime(start);
      const detail = event.start?.allDay ? '' : `${formatTime(start)}${end ? `–${formatTime(end)}` : ''}`;
      return `<article class="agenda-item${event.start?.allDay ? ' all-day' : ''}">
        <div class="time-block">${time}</div>
        <div class="event-block">
          <h3>${escapeHtml(event.title)}</h3>
          ${detail ? `<p>${detail}</p>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function escapeHtml(value = '') {
    return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  async function loadAgenda() {
    if (!CALENDAR_API_URL) {
      agendaStatus.textContent = 'Setup needed';
      return;
    }
    agendaStatus.textContent = 'Loading…';
    try {
      const response = await fetch(CALENDAR_API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Calendar API returned ${response.status}`);
      const data = await response.json();
      renderAgenda(data.events || []);
      agendaStatus.textContent = 'Live Cozi';
    } catch (error) {
      console.error(error);
      agendaStatus.textContent = 'Calendar unavailable';
    }
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
  loadAgenda();
  locationButton.addEventListener('click', requestLocation);
})();
