/* Чистая логика афиши: диапазоны дат, фильтры, группировка. Без DOM — проверяется тестами на Node.
 * В браузере доступна как глобальный объект TA, в Node — через require. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DAY = 86400000;
  var RANGES = ['today', 'tomorrow', 'weekend', 'week', 'all'];
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  function parseISO(s) { var p = s.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); }
  function toISO(d) { return d.toISOString().slice(0, 10); }
  function addDays(iso, n) { return toISO(new Date(parseISO(iso).getTime() + n * DAY)); }
  function weekday(iso) { return parseISO(iso).getUTCDay(); } // 0 — воскресенье

  /** Сегодняшняя дата по Москве (YYYY-MM-DD), независимо от пояса устройства. */
  function moscowToday(now) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(now || new Date());
  }

  function rangeFor(name, today) {
    if (name === 'today') return [today, today];
    if (name === 'tomorrow') { var t = addDays(today, 1); return [t, t]; }
    if (name === 'week') return [today, addDays(today, 6)];
    if (name === 'weekend') {
      var wd = weekday(today);
      if (wd === 6) return [today, addDays(today, 1)];
      if (wd === 0) return [today, today];
      return [addDays(today, 6 - wd), addDays(today, 7 - wd)];
    }
    return [today, addDays(today, 13)];
  }

  function inRange(ev, from, to) { var last = ev.end || ev.date; return ev.date <= to && last >= from; }
  function isRunning(ev, from) { return !!ev.end && ev.date < from; }
  function byStart(a, b) {
    return a.date.localeCompare(b.date) || (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title, 'ru');
  }
  function byEnd(a, b) { return a.end.localeCompare(b.end) || a.title.localeCompare(b.title, 'ru'); }

  /** События диапазона с фильтром по направлениям. Счётчики считаются БЕЗ фильтра по направлениям,
   *  чтобы на чипах было видно, сколько событий в каждом направлении. */
  function select(events, range, categories) {
    var from = range[0], to = range[1];
    var chosen = new Set(categories || []);
    var inR = events.filter(function (e) { return inRange(e, from, to); });
    var counts = {};
    inR.forEach(function (e) { counts[e.category] = (counts[e.category] || 0) + 1; });
    var filtered = chosen.size ? inR.filter(function (e) { return chosen.has(e.category); }) : inR;
    return {
      regular: filtered.filter(function (e) { return !isRunning(e, from); }).sort(byStart),
      running: filtered.filter(function (e) { return isRunning(e, from); }).sort(byEnd),
      counts: counts,
      total: filtered.length
    };
  }

  function groupByDate(events) {
    var groups = [];
    events.forEach(function (e) {
      var last = groups[groups.length - 1];
      if (last && last.date === e.date) last.events.push(e);
      else groups.push({ date: e.date, events: [e] });
    });
    return groups;
  }

  function dayLabel(iso, today) {
    if (iso === today) return 'Сегодня';
    if (iso === addDays(today, 1)) return 'Завтра';
    var d = parseISO(iso);
    return WEEKDAYS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }

  function parseParams(search) {
    var m = /[?&]d=([^&#]*)/.exec(search || '');
    var name = m ? decodeURIComponent(m[1]) : '';
    return RANGES.indexOf(name) >= 0 ? name : 'week';
  }

  /** Нажатие на чип: null — «Все» (сброс), иначе добавить/убрать направление. */
  function toggleCategory(current, category) {
    if (category === null) return [];
    return current.indexOf(category) >= 0 ? current.filter(function (c) { return c !== category; }) : current.concat([category]);
  }

  function timeLabel(ev) { return ev.time || 'в течение дня'; }

  return { RANGES: RANGES, moscowToday: moscowToday, addDays: addDays, rangeFor: rangeFor, select: select,
           groupByDate: groupByDate, dayLabel: dayLabel, parseParams: parseParams, toggleCategory: toggleCategory,
           timeLabel: timeLabel };
});
