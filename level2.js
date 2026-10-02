(function (global) {
  var PROGRAM = global.DSLevel2Data || [];
  var BLOCKS = [
    ["warmup", "Warm-up"],
    ["conditioning", "Conditioning"],
    ["strength", "Strength"],
    ["cooldown", "Cooldown"],
  ];
  var HINTS = {
    ss1: "Hold middle blue.",
    ss2: "Hold top of blue.",
    "tempo-intervals": "About 10s at ~70% speed, not all-out, then 60s active back toward middle blue.",
    "green-power": "5–10s at 100%, then 40–60s active back toward middle blue.",
    "green-endurance": "10–15s at 100%, then 60–90s back toward top of blue.",
    "green-threshold": "Hold top of green.",
    "blue-repeats": "One rep is middle blue, then top of blue, as the note says.",
    "green-repeats": "Top of green, then bottom of green. Do not spill into red.",
    "red-threshold": "Bottom of red. Clock starts on arrival.",
    "red-max": "Toward top of red.",
    "aerobic-plyos": "Submax low hops, eyes up. Not max plyos.",
    "explosive-repeat": "Quality reps. Miss twice and stop that set.",
    "tempo-lifting": "Constant breath, no pause.",
  };
  var LIFT_RULES = [
    { name: "Bench / floor press", test: function (n) { return /bench|floor press/.test(n); } },
    { name: "Overhead press", test: function (n) { return /overhead/.test(n) && !/row overhead/.test(n); } },
    { name: "Squat", test: function (n) { return /squat/.test(n) && !/jump|split|lunge/.test(n); } },
    { name: "Split squat", test: function (n) { return /split squat|elavated/.test(n); } },
    { name: "Deadlift", test: function (n) { return /deadlift/.test(n) && !/romanian|\brdl\b/.test(n); } },
    { name: "RDL", test: function (n) { return /romanian|\brdl\b/.test(n); } },
    { name: "Row", test: function (n) { return /\brow\b/.test(n); } },
    { name: "Pull-up / pulldown", test: function (n) { return /pull-up|pulldown/.test(n); } },
    { name: "Lunge", test: function (n) { return /lunge/.test(n); } },
  ];

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function key(week, day) { return "w" + week + "d" + day; }

  function getDay(week, day) {
    return PROGRAM.filter(function (plan) { return plan.week === week && plan.day === day; })[0];
  }

  function daysInWeek(week) {
    return PROGRAM.filter(function (plan) { return plan.week === week; });
  }

  function parseNum(raw) {
    var match = String(raw || "").trim().match(/-?\d+(\.\d+)?/);
    if (!match) return null;
    var n = Number(match[0]);
    return isFinite(n) ? n : null;
  }

  function rowsOf(plan) {
    var out = [];
    BLOCKS.forEach(function (pair) {
      (plan[pair[0]] || []).forEach(function (row) {
        out.push({ block: pair[0], title: pair[1], row: row });
      });
    });
    return out;
  }

  function logFor(l2, week, day) {
    return l2.logs[key(week, day)] || null;
  }

  function dayStatus(plan, log) {
    var rows = rowsOf(plan);
    var done = rows.filter(function (item) { return log && log.rows && log.rows[item.row.id] && log.rows[item.row.id].done; }).length;
    var touched = done > 0 || Boolean(log && (log.recoveryPct || log.recoveryDelta || log.review || log.assessmentDistance || log.assessmentTool));
    if (!touched && log && log.rows) {
      touched = rows.some(function (item) {
        var entry = log.rows[item.row.id];
        if (!entry) return false;
        return Boolean(entry.weight || entry.reps || entry.time || entry.rest || entry.hr || entry.used);
      });
    }
    if (!touched) return "empty";
    if (done === rows.length && rows.length) return "done";
    return "partial";
  }

  function recoveryBand(raw) {
    if (!String(raw || "").trim()) return "empty";
    var n = parseNum(raw);
    if (n === null || n < 0 || n > 100) return "invalid";
    return n < 80 ? "low" : "high";
  }

  function weekRecovery(week, logs) {
    var values = daysInWeek(week).map(function (plan) {
      return parseNum((logs[key(plan.week, plan.day)] || {}).recoveryPct || "");
    }).filter(function (n) { return n !== null && n >= 0 && n <= 100; });
    var early = week <= 2;
    if (!values.length) return { avg: null, count: 0, pullBack: false, early: early };
    var avg = values.reduce(function (sum, n) { return sum + n; }, 0) / values.length;
    var enough = values.length >= Math.ceil(daysInWeek(week).length / 2);
    var mostlyUnder = values.filter(function (n) { return n < 80; }).length > values.length / 2;
    var noneOver = values.every(function (n) { return n <= 86; });
    return { avg: avg, count: values.length, pullBack: enough && mostlyUnder && noneOver, early: early };
  }

  function weeksOneToFourTouched(logs) {
    var ok = true;
    for (var week = 1; week <= 4; week++) {
      var touched = daysInWeek(week).some(function (plan) {
        return dayStatus(plan, logs[key(plan.week, plan.day)]) !== "empty";
      });
      if (!touched) ok = false;
    }
    return ok;
  }

  function locked(l2, week) {
    return week >= 5 && !l2.bypassWeek5 && !weeksOneToFourTouched(l2.logs);
  }

  function firstOpen(logs) {
    for (var i = 0; i < PROGRAM.length; i++) {
      var plan = PROGRAM[i];
      if (dayStatus(plan, logs[key(plan.week, plan.day)]) !== "done") return plan;
    }
    return PROGRAM[PROGRAM.length - 1];
  }

  function missed(logs) {
    var open = firstOpen(logs);
    return PROGRAM.filter(function (plan) {
      if (plan.week > open.week || (plan.week === open.week && plan.day >= open.day)) return false;
      return dayStatus(plan, logs[key(plan.week, plan.day)]) !== "done";
    });
  }

  function calendarWeek(startDate) {
    if (!startDate) return null;
    var start = new Date(startDate + "T00:00:00");
    if (isNaN(start.getTime())) return null;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var diff = Math.floor((today.getTime() - start.getTime()) / 86400000);
    if (diff < 0) return 1;
    return Math.min(12, Math.floor(diff / 7) + 1);
  }

  function defaultUsed(row) {
    if (row.primary) return "Bike";
    if (row.options && row.options.length) {
      if (row.options.indexOf("Bike") !== -1) return "Bike";
      return row.options[0];
    }
    return row.exercise || row.label || "";
  }

  function dose(row, block) {
    var bits = [];
    if (row.sets && row.reps) bits.push(row.sets + " x " + row.reps);
    else if (row.sets && row.duration && String(row.sets).indexOf("x") === -1) bits.push(row.sets + " x " + row.duration);
    else {
      if (row.duration) bits.push(row.duration);
      if (row.sets) bits.push(row.sets);
      if (row.reps) bits.push(row.reps);
    }
    if (row.sets && row.reps && row.duration) bits.push(row.duration);
    if (row.load) bits.push(row.load);
    if (row.zone) bits.push(row.zone);
    if (block === "strength") bits.push(row.tempo ? row.tempo : "tempo —");
    else if (row.tempo) bits.push(row.tempo);
    if (row.rest) bits.push(row.pair ? "pair rest " + row.rest : "rest " + row.rest);
    return bits.join(" · ");
  }

  function ssMinutes(logs) {
    var totals = [];
    for (var week = 1; week <= 12; week++) {
      var total = 0;
      daysInWeek(week).forEach(function (plan) {
        var log = logs[key(plan.week, plan.day)];
        (plan.conditioning || []).forEach(function (row) {
          if (row.method !== "ss1" && row.method !== "ss2") return;
          var minutes = parseNum(log && log.rows && log.rows[row.id] ? log.rows[row.id].time : "");
          if (minutes !== null) total += minutes;
        });
      });
      totals.push(total);
    }
    return totals;
  }

  function liftTrends(logs) {
    var buckets = {};
    PROGRAM.forEach(function (plan) {
      var log = logs[key(plan.week, plan.day)];
      (plan.strength || []).forEach(function (row) {
        var entry = log && log.rows && log.rows[row.id];
        if (!entry || !String(entry.weight || "").trim()) return;
        var used = String(entry.used || defaultUsed(row)).toLowerCase();
        var rule = null;
        for (var i = 0; i < LIFT_RULES.length; i++) {
          if (LIFT_RULES[i].test(used)) { rule = LIFT_RULES[i]; break; }
        }
        if (!rule) return;
        if (!buckets[rule.name]) buckets[rule.name] = [];
        buckets[rule.name].push({ label: "W" + plan.week + "D" + plan.day, weight: String(entry.weight).trim() });
      });
    });
    return LIFT_RULES.map(function (rule) {
      return { name: rule.name, points: buckets[rule.name] || [] };
    }).filter(function (item) { return item.points.length; });
  }

  function nav(active) {
    function btn(id, label) {
      return '<button type="button" class="' + (active === id ? "on" : "") + '" data-l2-view="' + id + '">' + label + "</button>";
    }
    return '<nav class="nav nav-3">' + btn("today", "Today") + btn("weeks", "Weeks") + btn("review", "Review") + "</nav>";
  }

  function shell(ctx, body, active) {
    return (
      '<div class="top"><div class="brand">DAILY<span>STRAIN</span></div>' + ctx.accountHtml + "</div>" +
      ctx.switchHtml +
      body +
      nav(active)
    );
  }

  function field(label, value, attr, mode) {
    return (
      "<label><span>" + label + "</span>" +
      '<input ' + attr + ' inputmode="' + (mode || "text") + '" autocomplete="off" value="' + esc(value) + '">' +
      "</label>"
    );
  }

  function rowCard(plan, block, row, log) {
    var entry = (log && log.rows && log.rows[row.id]) || {};
    var used = entry.used || defaultUsed(row);
    var hint = row.method ? HINTS[row.method] : "";
    var choice = "";
    if (row.primary) {
      choice = '<p class="plates">Bike <span class="tiny">locked tool</span></p>';
    } else if (row.options && row.options.length) {
      choice =
        "<label><span>Exercise used</span><select data-used=\"" + esc(row.id) + "\">" +
        row.options.map(function (option) {
          return '<option value="' + esc(option) + '"' + (option === used ? " selected" : "") + ">" + esc(option) + "</option>";
        }).join("") +
        "</select></label>";
    } else {
      choice = field("Exercise used", used, 'data-l2-row="used" data-row="' + esc(row.id) + '"', "text");
    }
    var assessment = "";
    if (row.assessment) {
      assessment =
        field("Assessment distance", log ? log.assessmentDistance : "", 'data-l2-day="assessmentDistance"', "decimal") +
        '<p class="tiny">Tool locked: Bike</p>';
    }
    return (
      '<article class="card l2-row' + (entry.done ? " done" : "") + '">' +
        '<div class="l2-row-head">' +
          '<button type="button" class="done-btn' + (entry.done ? " on" : "") + '" data-done="' + esc(row.id) + '" aria-label="' + esc(entry.done ? "Mark not done" : "Mark done") + '">' + (entry.done ? "✓" : "") + "</button>" +
          "<div>" +
            (row.pair ? '<span class="badge">' + esc(row.pair) + "</span>" : "") +
            "<h2>" + esc(row.label) + "</h2>" +
            (row.exercise && row.exercise !== row.label ? "<p>Printed: " + esc(row.exercise) + "</p>" : "") +
            (row.asPrinted ? '<p class="warn">' + esc(row.asPrinted) + "</p>" : "") +
            "<p class=\"plates\">" + esc(dose(row, block)) + "</p>" +
            (hint ? "<p>" + esc(hint) + "</p>" : "") +
            (row.tempo === "4040" ? "<p>4040 means 4 seconds down, no pause, 4 seconds up, no pause.</p>" : "") +
            (row.reps && String(row.reps).indexOf("AMRAP") !== -1 ? "<p>AMRAP stops when technique breaks.</p>" : "") +
          "</div>" +
        "</div>" +
        choice +
        assessment +
        '<div class="log-grid">' +
          field("Weight", entry.weight || "", 'data-l2-row="weight" data-row="' + esc(row.id) + '"', "decimal") +
          field("Reps", entry.reps || "", 'data-l2-row="reps" data-row="' + esc(row.id) + '"', "text") +
          field("Time", entry.time || "", 'data-l2-row="time" data-row="' + esc(row.id) + '"', "text") +
          field("Rest", entry.rest || "", 'data-l2-row="rest" data-row="' + esc(row.id) + '"', "text") +
          field("HR", entry.hr || "", 'data-l2-row="hr" data-row="' + esc(row.id) + '"', "decimal") +
        "</div>" +
      "</article>"
    );
  }

  function todayView(state) {
    var l2 = state.level2;
    var plan = getDay(l2.week, l2.day) || getDay(1, 1);
    if (locked(l2, plan.week)) {
      return (
        '<p class="kicker">Level 2</p><h1>Week 5 stays locked.</h1>' +
        '<div class="card"><p>Log at least one session in each of weeks 1 through 4 first. The sheet does not skip ahead.</p>' +
        '<button class="btn" type="button" id="l2-bypass">I already did weeks 1–4</button></div>'
      );
    }
    var log = logFor(l2, plan.week, plan.day);
    var rows = rowsOf(plan);
    var done = rows.filter(function (item) {
      return log && log.rows && log.rows[item.row.id] && log.rows[item.row.id].done;
    }).length;
    var band = recoveryBand(log ? log.recoveryPct : "");
    var stats = weekRecovery(plan.week, l2.logs);
    var index = PROGRAM.indexOf(plan);
    var bandNote = "";
    if (band === "empty") bandNote = "<p>Under 80, take the low end of every printed range. 80 or above, the high end is available. The prescription does not change.</p>";
    if (band === "invalid") bandNote = '<p class="warn">Enter a number from 0 to 100.</p>';
    if (band === "low") bandNote = '<p class="warn">Under 80. Take the low end of every printed range. Do not add or delete sessions.</p>';
    if (band === "high") bandNote = '<p class="ok">80 or above. The high end of each printed range is available.</p>';
    var avg = stats.avg === null ? "No scores yet." : "This week: " + Math.round(stats.avg) + " from " + stats.count + " day" + (stats.count === 1 ? "" : "s") + ".";
    var blocks = BLOCKS.map(function (pair) {
      var items = plan[pair[0]] || [];
      if (!items.length && pair[0] !== "strength") return "";
      var body = items.length
        ? items.map(function (row) { return rowCard(plan, pair[0], row, log); }).join("")
        : '<div class="card"><p>No strength on this sheet.</p></div>';
      return '<p class="kicker">' + pair[1] + "</p>" + body;
    }).join("");
    var redNote = plan.color === "RED" && l2.matNote
      ? '<div class="card"><p class="warn">Mat note: ' + esc(l2.matNote) + ". This is a red day. Keep hard grappling off the day beside it.</p></div>"
      : "";
    return (
      '<div class="zone-strip ' + esc(plan.color) + '"></div>' +
      '<p class="kicker">Level 2 · Bike locked</p>' +
      '<div class="row"><h1>W' + plan.week + " D" + plan.day + '</h1><span class="badge zone-' + esc(plan.color) + '">' + esc(plan.color) + "</span></div>" +
      "<p>" + done + " / " + rows.length + " logged" +
        (band === "low" ? " · low end of every range" : "") +
        (band === "high" ? " · high end available" : "") +
      "</p>" +
      '<div class="row" style="margin-bottom:12px">' +
        '<button class="btn ghost tiny" type="button" data-step="-1"' + (index <= 0 ? " disabled" : "") + ">Prev</button>" +
        '<button class="btn ghost tiny" type="button" data-step="1"' + (index >= PROGRAM.length - 1 ? " disabled" : "") + ">Next</button>" +
      "</div>" +
      (plan.note ? '<div class="card"><p>' + esc(plan.note) + "</p></div>" : "") +
      redNote +
      '<div class="card">' +
        field("Morning recovery %", log ? log.recoveryPct : "", 'data-l2-day="recoveryPct"', "decimal") +
        bandNote +
        "<p>Week average target 80–85. " + avg + "</p>" +
        (stats.early ? "<p>First 1–2 weeks may sit under that average.</p>" : "") +
        (stats.pullBack ? '<p class="warn">Pull back. This week is mostly under 80 and nothing is over 86.</p>' : "") +
      "</div>" +
      blocks +
      '<div class="card"><p class="kicker">Sheet footer</p>' +
        field("Recovery +/−", log ? log.recoveryDelta : "", 'data-l2-day="recoveryDelta"', "text") +
        "<label><span>Workout review</span><textarea data-l2-day=\"review\">" + esc(log ? log.review : "") + "</textarea></label>" +
      "</div>"
    );
  }

  function weeksView(state) {
    var l2 = state.level2;
    var here = calendarWeek(l2.startDate);
    var next = firstOpen(l2.logs);
    var weeks = "";
    for (var week = 1; week <= 12; week++) {
      var days = daysInWeek(week);
      var stats = weekRecovery(week, l2.logs);
      var red = days.some(function (plan) { return plan.color === "RED"; });
      var chips = days.map(function (plan) {
        var status = dayStatus(plan, l2.logs[key(plan.week, plan.day)]);
        var rec = (l2.logs[key(plan.week, plan.day)] || {}).recoveryPct;
        var on = plan.week === l2.week && plan.day === l2.day ? " on" : "";
        return (
          '<button type="button" class="day-chip zone-' + esc(plan.color) + on + '" data-open="1" data-w="' + plan.week + '" data-d="' + plan.day + '">' +
            plan.color.slice(0, 1) + "<small>Day " + plan.day + (status === "done" ? " · done" : status === "partial" ? " · partial" : "") + "</small>" +
            "<small>" + esc(rec ? rec + "%" : "—") + "</small>" +
          "</button>"
        );
      }).join("");
      weeks +=
        '<div class="card">' +
          "<div class=\"row\"><h2>Week " + week + (here === week ? " · this week" : "") + "</h2><b>" +
            (stats.avg === null ? "—" : Math.round(stats.avg) + "%") + "</b></div>" +
          (stats.pullBack ? '<p class="warn">Pull back. Mostly under 80, nothing over 86.</p>' : "") +
          (stats.early ? "<p>Early weeks may sit under 80–85.</p>" : "") +
          (red && l2.matNote ? '<p class="warn">Red day this week. Check the mat note.</p>' : "") +
          '<div class="days l2-days">' + chips + "</div>" +
        "</div>";
    }
    var minutes = ssMinutes(l2.logs);
    var minuteBits = minutes.map(function (total, index) {
      return '<div class="stat"><b>' + (total > 0 ? total : "—") + "</b><span>W" + (index + 1) + "</span></div>";
    }).join("");
    return (
      '<p class="kicker">12 weeks · Bike locked</p><h1>Week board.</h1>' +
      "<p>Tap a day. Colors are the sheet: green, blue, red. Week recovery target is 80–85.</p>" +
      '<button class="btn" type="button" data-open="1" data-w="' + next.week + '" data-d="' + next.day + '">Next open · W' + next.week + " D" + next.day + "</button>" +
      '<div class="card">' +
        "<label><span>Block start</span><input type=\"date\" data-l2-meta=\"startDate\" value=\"" + esc(l2.startDate) + "\"></label>" +
        "<label><span>Mat note</span><input data-l2-meta=\"matNote\" value=\"" + esc(l2.matNote) + "\" placeholder=\"Which days you roll\"></label>" +
        "<p>On a red week, keep hard grappling off the day beside red.</p>" +
      "</div>" +
      weeks +
      '<div class="card"><p class="kicker">SS minutes you logged</p><div class="stats l2-stats">' + minuteBits + "</div>" +
      "<p>The sheet dose is not counted until you write the time.</p></div>"
    );
  }

  function reviewView(state) {
    var l2 = state.level2;
    var open = missed(l2.logs);
    var list = open.length
      ? open.map(function (plan) {
          var status = dayStatus(plan, l2.logs[key(plan.week, plan.day)]);
          return '<button type="button" class="chip" data-open="1" data-w="' + plan.week + '" data-d="' + plan.day + '">W' + plan.week + " D" + plan.day + " · " + status + "</button>";
        }).join("")
      : "<p>Nothing skipped before the next open session.</p>";
    var pulls = [];
    for (var week = 1; week <= 12; week++) {
      var stats = weekRecovery(week, l2.logs);
      if (stats.pullBack) pulls.push("Week " + week);
    }
    var assess = l2.logs[key(5, 1)];
    var assessText = assess && String(assess.assessmentDistance || "").trim()
      ? "Week 5 day 1: " + assess.assessmentDistance.trim() + " on Bike."
      : "Week 5 day 1 assessment is not logged yet.";
    var lifts = liftTrends(l2.logs);
    var liftHtml = lifts.length
      ? lifts.map(function (lift) {
          var last = lift.points[lift.points.length - 1];
          var prev = lift.points.length > 1 ? lift.points[lift.points.length - 2] : null;
          return "<p><b>" + esc(lift.name) + "</b><br>" + esc(prev ? prev.weight + " → " + last.weight : last.weight) + " <span>" + esc(last.label) + "</span></p>";
        }).join("")
      : "<p>Weights show up here after you log them on a repeated lift.</p>";
    return (
      '<p class="kicker">Still open</p><h1>Before the next week.</h1>' +
      "<p>Days you left unfinished before the next open session. The printed week does not get rewritten.</p>" +
      '<div class="card"><div class="chips">' + list + "</div></div>" +
      '<div class="card"><p class="kicker">Pull back</p><p>' + (pulls.length ? esc(pulls.join(", ")) + " — mostly under 80 and nothing over 86." : "No week is asking you to pull back.") + "</p></div>" +
      '<div class="card"><p class="kicker">Assessment</p><p>' + esc(assessText) + "</p></div>" +
      '<div class="card"><p class="kicker">Repeated lifts</p>' + liftHtml + "</div>" +
      "<p class=\"tiny\">" + PROGRAM.length + " sessions on the sheet. Conditioning tool stays Bike.</p>"
    );
  }

  function render(state, ctx) {
    var l2 = state.level2;
    var body = l2.view === "weeks" ? weeksView(state) : l2.view === "review" ? reviewView(state) : todayView(state);
    return shell(ctx, body, l2.view === "weeks" || l2.view === "review" ? l2.view : "today");
  }

  function ensureDay(l2, week, day) {
    var id = key(week, day);
    if (!l2.logs[id]) {
      l2.logs[id] = { recoveryPct: "", recoveryDelta: "", review: "", assessmentDistance: "", assessmentTool: "", rows: {} };
    }
    if (!l2.logs[id].rows) l2.logs[id].rows = {};
    return l2.logs[id];
  }

  function ensureRow(log, id) {
    if (!log.rows[id]) log.rows[id] = { done: false, weight: "", reps: "", time: "", rest: "", hr: "" };
    return log.rows[id];
  }

  function bind(state, ctx) {
    var l2 = state.level2;
    document.querySelectorAll("[data-l2-view]").forEach(function (el) {
      el.addEventListener("click", function () {
        l2.view = el.getAttribute("data-l2-view");
        ctx.render();
      });
    });
    document.querySelectorAll("[data-open]").forEach(function (el) {
      el.addEventListener("click", function () {
        l2.week = Number(el.getAttribute("data-w"));
        l2.day = Number(el.getAttribute("data-d"));
        l2.view = "today";
        ctx.render();
      });
    });
    document.querySelectorAll("[data-step]").forEach(function (el) {
      el.addEventListener("click", function () {
        if (el.disabled) return;
        var plan = getDay(l2.week, l2.day) || PROGRAM[0];
        var index = PROGRAM.indexOf(plan) + Number(el.getAttribute("data-step"));
        if (index < 0 || index >= PROGRAM.length) return;
        l2.week = PROGRAM[index].week;
        l2.day = PROGRAM[index].day;
        l2.view = "today";
        ctx.render();
      });
    });
    var bypass = document.getElementById("l2-bypass");
    if (bypass) {
      bypass.addEventListener("click", function () {
        l2.bypassWeek5 = true;
        ctx.render();
      });
    }
    document.querySelectorAll("[data-done]").forEach(function (el) {
      el.addEventListener("click", function () {
        var log = ensureDay(l2, l2.week, l2.day);
        var row = ensureRow(log, el.getAttribute("data-done"));
        row.done = !row.done;
        ctx.render();
      });
    });
    document.querySelectorAll("[data-l2-day]").forEach(function (el) {
      var write = function () {
        var log = ensureDay(l2, l2.week, l2.day);
        log[el.getAttribute("data-l2-day")] = el.value;
        ctx.save();
      };
      el.addEventListener("input", write);
      el.addEventListener("change", function () {
        write();
        if (el.getAttribute("data-l2-day") === "recoveryPct") ctx.render();
      });
    });
    document.querySelectorAll("[data-l2-row]").forEach(function (el) {
      el.addEventListener("input", function () {
        var log = ensureDay(l2, l2.week, l2.day);
        var row = ensureRow(log, el.getAttribute("data-row"));
        row[el.getAttribute("data-l2-row")] = el.value;
        ctx.save();
      });
    });
    document.querySelectorAll("[data-used]").forEach(function (el) {
      el.addEventListener("change", function () {
        var log = ensureDay(l2, l2.week, l2.day);
        var row = ensureRow(log, el.getAttribute("data-used"));
        row.used = el.value;
        ctx.save();
      });
    });
    document.querySelectorAll("[data-l2-meta]").forEach(function (el) {
      el.addEventListener("input", function () {
        l2[el.getAttribute("data-l2-meta")] = el.value;
        ctx.save();
      });
    });
  }

  global.DSLevel2 = {
    render: render,
    bind: bind,
    key: key,
    dayStatus: dayStatus,
    locked: locked,
    missed: missed,
  };
})(window);
