(() => {
  const greetingEl = document.getElementById('greeting');
  const dateEl = document.getElementById('dateLabel');
  const locationEl = document.getElementById('locationLabel');
  const locationButton = document.getElementById('locationButton');
  const agendaList = document.getElementById('agendaList');
  const agendaStatus = document.getElementById('agendaStatus');

  const fallbackLocation = 'Morristown, NJ';
  const CALENDAR_API_URL = 'https://daily-planner-calendar.bill-crean.workers.dev/agenda';
  const AGENDA_REFRESH_MS = 5 * 60 * 1000;

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

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function eventStartDateKey(event) {
    if (event.start?.allDay) return event.start.date || null;
    return event.start?.dateTime?.slice(0, 10) || null;
  }

  function occursToday(event) {
    const today = localDateKey();
    const start = eventStartDateKey(event);
    if (!start) return false;

    if (!event.start?.allDay) return start === today;

    // iCalendar all-day DTEND is exclusive. A one-day event that starts
    // Sept 9 and ends Sept 10 therefore belongs to Sept 9 only.
    const end = event.end?.date || null;
    return start <= today && (!end || today < end);
  }

  function timeParts(dateTime) {
    const match = dateTime?.match(/T(\d{2}):(\d{2})/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  }

  function formatTime(dateTime) {
    const parts = timeParts(dateTime);
    if (!parts) return '';
    const date = new Date(2000, 0, 1, parts.hour, parts.minute);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function splitPersonFromTitle(title = '') {
    const match = title.match(/^([^:]{1,24}):\s*(.+)$/);
    if (!match) return { person: null, title };
    return { person: match[1].trim(), title: match[2].trim() };
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[char]);
  }

  function renderAgenda(events) {
    const todayEvents = events.filter(occursToday);

    todayEvents.sort((a, b) => {
      if (a.start?.allDay && !b.start?.allDay) return -1;
      if (!a.start?.allDay && b.start?.allDay) return 1;
      const aKey = a.start?.dateTime || a.start?.date || '';
      const bKey = b.start?.dateTime || b.start?.date || '';
      return aKey.localeCompare(bKey);
    });

    if (!todayEvents.length) {
      agendaList.innerHTML = '<div class="empty-state">No events scheduled today.</div>';
      return;
    }

    agendaList.innerHTML = todayEvents.map((event) => {
      const display = splitPersonFromTitle(event.title || 'Untitled event');
      const isAllDay = Boolean(event.start?.allDay);
      const startTime = isAllDay ? '' : formatTime(event.start?.dateTime);
      const endTime = isAllDay ? '' : formatTime(event.end?.dateTime);
      const timeLabel = isAllDay ? 'All day' : startTime;
      const detail = !isAllDay && startTime
        ? `${startTime}${endTime ? `–${endTime}` : ''}`
        : '';

      return `<article class="agenda-item${isAllDay ? ' all-day' : ''}">
        <div class="time-block">${escapeHtml(timeLabel)}</div>
        <div class="event-block">
          <div class="event-title-row">
            <h3>${escapeHtml(display.title)}</h3>
            ${display.person ? `<span class="person-badge">${escapeHtml(display.person)}</span>` : ''}
          </div>
          ${detail ? `<p>${escapeHtml(detail)}${event.recurring ? ' · Recurring' : ''}</p>` : (event.recurring ? '<p>Recurring</p>' : '')}
        </div>
      </article>`;
    }).join('');
  }

  async function loadAgenda() {
    agendaStatus.textContent = 'Loading…';
    agendaStatus.classList.remove('status-error');

    try {
      const response = await fetch(CALENDAR_API_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Calendar API returned ${response.status}`);
      const data = await response.json();
      renderAgenda(Array.isArray(data.events) ? data.events : []);
      agendaStatus.textContent = 'Live Cozi';
    } catch (error) {
      console.error(error);
      agendaStatus.textContent = 'Calendar unavailable';
      agendaStatus.classList.add('status-error');
      agendaList.innerHTML = '<div class="empty-state">Couldn\'t load Cozi right now. The planner will try again automatically.</div>';
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

  // Keep the greeting/date fresh if the planner is left open, and refresh Cozi
  // periodically without requiring a manual reload.
  setInterval(renderDateAndGreeting, 60 * 1000);
  setInterval(loadAgenda, AGENDA_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderDateAndGreeting();
      loadAgenda();
    }
  });
})();
