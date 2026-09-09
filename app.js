(() => {
  const greetingEl = document.getElementById('greeting');
  const dateEl = document.getElementById('dateLabel');
  const locationEl = document.getElementById('locationLabel');
  const locationButton = document.getElementById('locationButton');
  const agendaList = document.getElementById('agendaList');
  const agendaStatus = document.getElementById('agendaStatus');
  const weatherStatus = document.getElementById('weatherStatus');
  const weatherIcon = document.getElementById('weatherIcon');
  const currentTemp = document.getElementById('currentTemp');
  const conditions = document.getElementById('conditions');
  const highTemp = document.getElementById('highTemp');
  const lowTemp = document.getElementById('lowTemp');
  const rainChance = document.getElementById('rainChance');
  const hourlyStrip = document.getElementById('hourlyStrip');

  const FALLBACK_LOCATION = {
    label: 'Morristown, NJ',
    latitude: 40.7968,
    longitude: -74.4815
  };

  const CALENDAR_API_URL = 'https://daily-planner-calendar.bill-crean.workers.dev/agenda';
  const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
  const AGENDA_REFRESH_MS = 5 * 60 * 1000;
  const WEATHER_REFRESH_MS = 15 * 60 * 1000;

  let activeLocation = FALLBACK_LOCATION;

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

  function weatherCodeInfo(code, isDay = 1) {
    const day = Boolean(isDay);
    if (code === 0) return { label: 'Clear', icon: day ? '☀️' : '🌙' };
    if (code === 1) return { label: 'Mostly clear', icon: day ? '🌤️' : '🌙' };
    if (code === 2) return { label: 'Partly cloudy', icon: '⛅' };
    if (code === 3) return { label: 'Cloudy', icon: '☁️' };
    if ([45, 48].includes(code)) return { label: 'Foggy', icon: '🌫️' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Drizzle', icon: '🌦️' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Rain', icon: '🌧️' };
    if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', icon: '🌨️' };
    if ([95, 96, 99].includes(code)) return { label: 'Thunderstorms', icon: '⛈️' };
    return { label: 'Weather', icon: '🌡️' };
  }

  function roundTemp(value) {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  function formatHourLabel(isoTime, index) {
    if (index === 0) return 'Now';
    const hour = Number(isoTime?.slice(11, 13));
    if (!Number.isFinite(hour)) return 'Later';
    const date = new Date(2000, 0, 1, hour, 0);
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric' }).format(date);
  }

  function renderHourly(data) {
    const times = data.hourly?.time || [];
    const temps = data.hourly?.temperature_2m || [];
    const currentTime = data.current?.time;
    if (!times.length || !temps.length || !currentTime) return;

    let startIndex = times.findIndex((time) => time >= currentTime);
    if (startIndex < 0) startIndex = Math.max(0, times.length - 1);

    const indexes = [0, 2, 4, 6]
      .map((offset) => Math.min(startIndex + offset, times.length - 1))
      .filter((value, index, array) => array.indexOf(value) === index);

    hourlyStrip.innerHTML = indexes.map((hourIndex, displayIndex) => {
      const temp = roundTemp(temps[hourIndex]);
      return `<div class="hour"><span>${escapeHtml(formatHourLabel(times[hourIndex], displayIndex))}</span><strong>${temp == null ? '—' : `${temp}°`}</strong></div>`;
    }).join('');
  }

  function renderWeather(data) {
    const current = data.current || {};
    const daily = data.daily || {};
    const info = weatherCodeInfo(current.weather_code, current.is_day);

    weatherIcon.textContent = info.icon;
    currentTemp.textContent = `${roundTemp(current.temperature_2m) ?? '—'}°`;
    conditions.textContent = info.label;
    highTemp.textContent = `${roundTemp(daily.temperature_2m_max?.[0]) ?? '—'}°`;
    lowTemp.textContent = `${roundTemp(daily.temperature_2m_min?.[0]) ?? '—'}°`;
    rainChance.textContent = `${Math.round(daily.precipitation_probability_max?.[0] ?? 0)}%`;
    renderHourly(data);
  }

  async function loadWeather(location = activeLocation) {
    weatherStatus.textContent = 'Loading…';
    weatherStatus.classList.remove('status-error');

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: 'temperature_2m,weather_code,is_day',
      hourly: 'temperature_2m,precipitation_probability',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'inch',
      timezone: 'auto',
      forecast_days: '2'
    });

    try {
      const response = await fetch(`${WEATHER_API_URL}?${params.toString()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Weather API returned ${response.status}`);
      const data = await response.json();
      renderWeather(data);
      weatherStatus.textContent = 'Live weather';
    } catch (error) {
      console.error(error);
      weatherStatus.textContent = 'Weather unavailable';
      weatherStatus.classList.add('status-error');
      conditions.textContent = 'Couldn\'t load weather right now.';
    }
  }

  function useFallbackLocation() {
    activeLocation = FALLBACK_LOCATION;
    locationEl.textContent = FALLBACK_LOCATION.label;
    locationButton.textContent = '⌖';
    locationButton.disabled = false;
    locationButton.title = 'Use my current location';
    loadWeather(activeLocation);
  }

  function requestLocation() {
    if (!('geolocation' in navigator)) {
      useFallbackLocation();
      locationButton.disabled = true;
      locationButton.title = 'Location is not supported in this browser';
      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = '…';
    locationButton.title = 'Requesting location';
    locationEl.textContent = 'Finding your location…';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        activeLocation = {
          label: 'Current location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        locationEl.textContent = 'Current location';
        locationButton.textContent = '✓';
        locationButton.disabled = false;
        locationButton.title = 'Refresh current location';
        loadWeather(activeLocation);
      },
      () => {
        useFallbackLocation();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    );
  }

  renderDateAndGreeting();
  loadAgenda();
  requestLocation();

  locationButton.addEventListener('click', requestLocation);

  setInterval(renderDateAndGreeting, 60 * 1000);
  setInterval(loadAgenda, AGENDA_REFRESH_MS);
  setInterval(() => loadWeather(activeLocation), WEATHER_REFRESH_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderDateAndGreeting();
      loadAgenda();
      loadWeather(activeLocation);
    }
  });
})();
