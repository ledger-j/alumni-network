/* UniCircle page module: #benefits ("Why UniCircle") see js/pages/_shared.js for the contract.
   Renders the benefit tiles from one list. Each tile links to its route. Plain copy, no numbers.
   The public landing (components/landing.html) carries the same list as static HTML. */
(function () {
  'use strict';
  window.UCPages = window.UCPages || {};

  const ITEMS = [
    { route: 'network',   hue: 275, icon: 'ph:users-three-bold', title: 'Alumni network',
      text: 'Find people from your programme, city or sector, and say hello.' },
    { route: 'mentoring', hue: 45,  icon: 'ph:handshake-bold',   title: 'Mentor & Tutor',
      text: 'Ask an alumnus for advice, or get help with a course from an advanced student.' },
    { route: 'map',       hue: 25,  icon: 'ph:map-pin-bold',     title: 'Live map',
      text: 'See where your people are, at city level. Never a street.' },
    { route: 'events',    hue: 305, icon: 'ph:calendar-dots-bold', title: 'Events',
      text: 'Meetups and talks from the circle, with a simple RSVP.' },
    { route: 'pbl-hub',   hue: 145, icon: 'ph:briefcase-bold',   title: 'Case Hub',
      text: 'Open a real-world case and work on it with students and alumni.' },
    { route: 'jobs',      hue: 185, icon: 'ph:suitcase-simple-bold', title: 'Jobs',
      text: 'Roles shared by alumni, for alumni.' },
    { route: 'benefits',  hue: 90,  icon: 'ph:microphone-bold',  title: 'Jev, your voice assistant', fresh: true,
      text: 'Ask for people, events or cases by voice. Coming soon.' },
    { route: 'jobs',      hue: 260, icon: 'ph:heart-bold',       title: 'Supporter tier',
      text: 'Chip in to keep UniCircle independent. Optional, and not live yet.' }
  ];

  window.UCPages['benefits'] = function (root) {
    const grid = root && root.querySelector('[data-bn-grid]');
    if (!grid) return;
    const esc = (s) => window.UCP.esc(s);
    grid.innerHTML = ITEMS.map((it) =>
      '<a class="uc-bn-tile uc-connect" href="#' + esc(it.route) + '" style="--h:' + it.hue + '">'
      + '<span class="uc-bn-ic" aria-hidden="true"><span class="iconify" data-icon="' + esc(it.icon) + '"></span></span>'
      + '<span class="uc-bn-t">' + esc(it.title) + (it.fresh ? ' <span class="uc-bn-new">new</span>' : '') + '</span>'
      + '<span class="uc-bn-d">' + esc(it.text) + '</span>'
      + '<span class="uc-bn-go" aria-hidden="true">→</span></a>').join('');
  };
})();
