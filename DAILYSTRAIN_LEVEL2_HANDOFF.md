# DailyStrain Level 2 handoff

Give this whole zip to the agent that owns the live DailyStrain project. Do not deploy the GitHub repo over the live site.

## What the user asked

Add the Metamorphosis Level 2 sheet (12 weeks, 66 sessions, Joel Jamieson / 8 Weeks Out conditioning, Martial Athletics logger) as another tab on https://dailystrain.com.

Same system as the strength logger already there:

- Same phone save
- Same Google sign-in sync
- Strength program stays as it is
- Level 2 is a second program, not a rewrite of the lift days

The user could not see any change. That report is correct.

## What is actually live (checked 2026-10-02, 12:42 PM CDT)

https://dailystrain.com is Netlify. It is not serving the GitHub commit below.

Live index.html is 1,176 bytes and loads:

- css/app.css?v=30
- js/firebase-config.js?v=30
- js/engine.js?v=30
- js/data.js?v=30
- js/store.js?v=30
- js/sync.js?v=30
- js/app.js?v=30

Live js/app.js is 55,573 bytes. It does not contain programSwitchHtml, level2, or DSLevel2.

https://dailystrain.com/js/level2.js returns 404. The v=13 URL also 404s.

Live app starts like this:

```js
(function () {
  var state = DSStore.load();
  var view = state.onboarded ? "home" : "tour";
```

Bottom nav on the live app is three buttons: Today, Program, Log. The nav class is `nav three`.

Live store (js/store.js, 6,180 bytes):

- localStorage key dailystrain.v3
- DSStore.load() takes no uid argument
- DSStore.save(state, { touch }) only stamps updatedAt when touch is true
- State includes enabledDays, runs, runsPlaced, sessionsByDay, hangPlaced, a dead-hang accessory, and days 1 through 7
- DSStore.isSparse(state) decides whether a cloud copy counts as empty

Live sync (js/sync.js):

- Google auth plus Firestore users/{uid}
- The saved blob is the whole state object
- DSSync.queuePush(state) runs only from persist(true)

```js
function persist(dirty) {
  DSStore.save(state, { touch: !!dirty });
  if (dirty && window.DSSync) DSSync.queuePush(state);
}
```

A Level 2 log must call persist(true). Otherwise it stays on that phone until something else marks the state dirty.

## What was tried, and why the site did not change

The GitHub repo ryantrichardson/dailystrain was treated as the source of the live site. It is not. Before this attempt its latest commit was 660a1cb on 2026-09-16.

That repo is an older app:

- js/app.js was about 31 KB
- DSStore.load(null) and per-uid keys
- Nav was Week / Lift / Log / Maxes
- No runs, no enabledDays, no sessionsByDay, no dead hang
- netlify.toml says publish = "deploy"

A Level 2 tab was committed onto that old copy:

- Commit de4d05630d049d92fca11ff8f42290bb1fc73e4a
- Message: Add Metamorphosis Level 2 as its own tab.
- https://github.com/ryantrichardson/dailystrain/commit/de4d05630d049d92fca11ff8f42290bb1fc73e4a
- Files: js/app.js, js/store.js, js/level2.js, js/level2-data.js, css/app.css, index.html, and the same paths under deploy/

Netlify did not pick that up. The live site stayed on v=30.

Do not publish that repo. Do not copy its app.js or store.js into the live project. That would roll the strength logger back to the September version and drop runs, day toggles, dead hangs, and the current session model.

level2.js and level2-data.js from that commit are usable. They are in this zip. Wire them into the current project. Do not replace the current app with the GitHub app.js.

## What to build

A switch under the logo on every screen:

- Strength (default, current app)
- Level 2

state.program is "strength" or "level2". Missing or anything else means "strength", so existing users stay on the strength logger.

When state.program is "level2", do not render Today / Program / Log. Render the Level 2 shell instead. The strength views, day chips, runs, and accessories stay untouched for when they switch back.

### State to add on the existing object

Do not start a new localStorage key. Put this on the same dailystrain.v3 object the cloud already stores:

```js
program: "strength",
level2: {
  week: 1,
  day: 1,
  view: "today",
  tool: "bike",
  bypassWeek5: false,
  startDate: "",
  matNote: "",
  logs: {}
}
```

view is "today", "weeks", or "review".

Day log key is w{week}d{day}, for example w1d1:

```js
{
  recoveryPct: "",
  recoveryDelta: "",
  review: "",
  assessmentDistance: "",
  assessmentTool: "",
  rows: {
    "w1d1-co-1": {
      done: false,
      used: "",
      weight: "",
      reps: "",
      time: "",
      rest: "",
      hr: ""
    }
  }
}
```

load() must fill program and level2 when an old save does not have them, without resetting maxes, history, sessions, runs, or accessories.

isSparse() must return false if Level 2 has any recovery, review, assessment, or row log. Otherwise a signed-in phone can treat a Level 2-only save as empty and drop it on sync.

On cloud pull: if the remote state has no Level 2 work and this phone does, keep this phone's level2. If this phone was on Level 2, keep program as "level2" too. If both have Level 2 work, keep the remote copy, same as strength does today.

### How to hook the current app.js

In render, before the strength views:

```js
if (state.program === "level2" && window.DSLevel2) {
  root.innerHTML = DSLevel2.render(state, {
    accountHtml: accountHtml(),
    escapeAttr: escapeAttr,
    switchHtml: programSwitchHtml()
  });
  bind();
  DSLevel2.bind(state, {
    render: function () { render(true); },
    save: function () { persist(true); }
  });
  return;
}
```

save must be persist(true). persist() with no argument will not sync to Google.

Put the same Strength / Level 2 switch on the strength screens (tour, home, program, log) so they can leave Level 2. Buttons use data-program="strength" and data-program="level2". In bind(), a click sets state.program and calls render(true).

Add the scripts to the live index.html before app.js, and bump the cache query. It is v=30 now:

```html
<script src="js/level2-data.js?v=31"></script>
<script src="js/level2.js?v=31"></script>
```

level2-data.js sets window.DSLevel2Data to the 66-day sheet.
level2.js sets window.DSLevel2 to { render, bind, key, dayStatus, locked, missed }.

Match the existing dark DailyStrain look. The module already uses cards, gold, and the Bebas / Oswald / Outfit stack. Append these to the live app.css if they are missing:

- .prog-switch two-column toggle
- .nav-3 three-column bottom nav
- .zone-strip.GREEN #7d9a62, .zone-strip.BLUE #6aa0c8, .zone-strip.RED #c45c4a
- .zone-GREEN / .zone-BLUE / .zone-RED text colors for day chips
- .l2-row-head, .done-btn, .log-grid, .l2-days (3 columns), .l2-stats (4 columns)
- textarea styled like the inputs

### Level 2 behavior the module already implements

The sheet is exact. 66 days. Counts per week: 5, 5, 5, 6, 6, 6, 6, 5, 6, 6, 5, 5.

- Today opens on week 1 day 1 until they move.
- Prev / Next walk the printed order.
- Bike is the locked conditioning tool. Primary rows show Bike and do not become a picker. Rows that say "or" are a short picker. Bike is the default when it is one of the options.
- Each row logs done, exercise used, weight, reps, time, rest, and HR.
- Morning recovery percent. Under 80: take the low end of every printed range. 80 or above: the high end is available. The printed dose does not change. Reject numbers outside 0 to 100.
- Week target is 80 to 85. Pull-back flag only when at least half the days in that week have a score, most are under 80, and none are over 86. Weeks 1 and 2 may sit under the average. Say so. Do not delete sessions.
- Sheet footer on every day: Recovery +/- and Workout review.
- Empty strength blocks stay empty. There are three: week 4 day 3, week 7 day 6, week 12 day 3. The copy is "No strength on this sheet."
- Printed typos stay, including Repeition and Rear-foot-elavated (asPrinted on the row).
- Week 5 day 1 has the assessment row. Distance is stored on the day as assessmentDistance. The tool text is Bike, not a free field.
- Week 5 and later stay locked until each of weeks 1, 2, 3, and 4 has at least one touched day. The button "I already did weeks 1-4" sets bypassWeek5.
- Weeks board: 12 weeks, color chips, recovery average, pull-back line, optional block start date, optional mat note. A red day plus a mat note warns to keep hard grappling off the day beside red.
- SS minutes add up only logged time on ss1 and ss2 rows. The printed dose is not counted.
- Review lists days left unfinished before the next open session, pull-back weeks, the week 5 assessment, and repeated-lift weights (bench / floor press, overhead press, squat, split squat, deadlift, RDL, row, pull-up / pulldown, lunge).
- Do not invent exercises, sets, days, or methods.

Method helper lines already in level2.js: ss1, ss2, tempo-intervals, green-power, green-endurance, green-threshold, blue-repeats, green-repeats, red-threshold, red-max, aerobic-plyos, explosive-repeat, tempo-lifting. 4040 tempo and AMRAP each have one line. Those notes do not replace the printed dose.

## Files in this zip

- DAILYSTRAIN_LEVEL2_HANDOFF.md this note
- level2-data.js the 66-day sheet. Do not edit the doses.
- level2.js the Today / Weeks / Review UI. It only reads state.level2 and the two callbacks. It does not know about lifts, runs, or Firebase.

## Do not

- Do not deploy ryantrichardson/dailystrain at de4d056 to Netlify. The live site is ahead of that repo.
- Do not point dailystrain.com at the separate Level 2 preview from the other Grok chat. That logger uses its own storage key, metamorphosis-l2. Publishing it would replace the strength site, not add a tab.
- Do not put Level 2 logs in a second localStorage key. They belong on dailystrain.v3 and in the same Firestore user document.
