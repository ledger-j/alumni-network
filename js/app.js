/* ==========================================
   UniCircle — UM Alumni Network
   SPA Router & Dynamic Fallback Controller (Jun 2026)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  const routes = {
    feed: 'components/feed.html',
    network: 'components/network.html',
    'pbl-hub': 'components/pbl-hub.html',
    events: 'components/events.html',
    jobs: 'components/jobs.html'
  };

  // ==========================================
  // HIGH-FIDELITY BUNDLED TEMPLATE FALLBACKS
  // (Provides 100% offline file:// capability)
  // ==========================================
  const fallbacks = {
    feed: `
<div class="app-layout">
  
  <!-- LEFT COLUMN: USER PROFILE CARD -->
  <aside class="profile-sidebar" role="complementary" aria-label="Profile Summary">
    <div class="sbe-card profile-card">
      <div class="cover-banner"></div>
      
      <div class="avatar-container">
        <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Jean Maurice profile picture" class="avatar">
        <span class="premium-badge" title="Premium Alumni Member"><span class="iconify" data-icon="ph:crown-fill"></span></span>
      </div>

      <div class="profile-info">
        <h2 class="name">Jean Maurice H. <span class="iconify" data-icon="ph:seal-check-fill" style="color: var(--um-light-blue); font-size: 16px;" title="Verified Alumnus"></span></h2>
        <p class="title">M.Sc. Financial Economics | B.Sc. International Business<br><strong>Maastricht University — UniCircle</strong></p>
        <p class="meta"><span class="iconify" data-icon="ph:map-pin-bold"></span> Maastricht, Limburg</p>
      </div>

      <div class="profile-stats">
        <div class="stat-row">
          <span class="label">Profile viewers</span>
          <span class="value">87</span>
        </div>
        <div class="stat-row" style="border-top: 1.5px solid var(--color-border);">
          <span class="label">Post impressions</span>
          <span class="value">15</span>
        </div>
      </div>
    </div>

    <!-- Decorative Campus Visual Widget -->
    <div class="sbe-card navigation-widget" style="padding: 0; overflow: hidden; height: 180px; position: relative;">
      <img src="Image_ressources/Mood_images/um-tapijn-202010-005_2.jpg" alt="Maastricht Tapijn Campus" style="width: 100%; height: 100%; object-fit: cover;">
      <div style="position: absolute; bottom: 0; inset-inline: 0; background: linear-gradient(to top, var(--um-dark-blue) 0%, transparent 100%); padding: var(--space-3); color: white;">
        <h4 style="color: white; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">UM Tapijn Campus</h4>
        <p style="font-size: 9px; color: oklch(1 0 0 / 0.8); margin-top: 2px;">Maastricht University</p>
      </div>
    </div>
  </aside>

  <!-- CENTER COLUMN: ACTIVE DASHBOARD FEED -->
  <main class="feed-content" role="main" aria-label="Dashboard Feed">
    
    <!-- Post Creation Box -->
    <div class="sbe-card create-post-box">
      <div class="input-row">
        <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Your avatar" class="avatar">
        <button class="trigger-btn">What's on your mind? Share with the UM network...</button>
      </div>
      <div class="media-row">
        <button class="media-btn photo"><span class="iconify" data-icon="ph:image-bold"></span> Photo</button>
        <button class="media-btn video"><span class="iconify" data-icon="ph:video-camera-bold"></span> Video</button>
        <button class="media-btn article"><span class="iconify" data-icon="ph:article-bold"></span> Write article</button>
      </div>
    </div>

    <!-- Feed View Selector -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); padding-inline: var(--space-2);">
      <hr style="flex: 1; border: none; height: 1px; background-color: var(--color-border); margin-right: var(--space-3);">
      <span style="font-size: 11px; color: var(--color-text-secondary); display: flex; align-items: center; gap: 4px;">
        Sort by: <strong style="color: var(--color-text-primary); cursor: pointer; display: flex; align-items: center;">Most relevant <span class="iconify" data-icon="ph:caret-down-bold"></span></strong>
      </span>
    </div>

    <!-- Posts Feed Container -->
    <div class="feed-posts-list">
      
      <!-- POST 1: PBL CASE COLLABORATION (SBE Specific) -->
      <article class="sbe-card feed-post">
        <div class="post-header">
          <div class="author-info">
            <img src="Image_ressources/Mood_images/maxme2014_27556_A_warm_summer_day_in_a_typical_Dutch_town.Narro_f110bf84-696b-43be-817a-95c4168d14d2.png" alt="Ruben Hassid" class="avatar">
            <div class="details">
              <span class="name">Ruben Hassid <span class="degree-badge msc">M.Sc. Econometrics</span></span>
              <span class="headline">Senior Portfolio Risk Architect | SBE Finance Alumni Lead</span>
              <span class="time">2 hours ago • <span class="iconify" data-icon="ph:globe-hemisphere-east-bold"></span></span>
            </div>
          </div>
          <button class="options-btn" aria-label="Post Options">⋮</button>
        </div>

        <div class="post-content">
          <p>Maastricht's Problem-Based Learning (PBL) doesn't stop when you graduate. Real financial markets are the ultimate tutorial group! 📊</p>
          <p>I just posted a complex hedging challenge to our SBE PBL Hub. We are evaluating option spreads under extreme inflationary shifts. If you studied with me in the <strong>2024 Period 5 Finance Tutorial 01</strong>, or are an SBE risk enthusiast, jump in and let's solve this case together!</p>
          <p class="hashtag">#MaastrichtUniversity #SBEFinance #ProblemBasedLearning #HedgingCase</p>
          
          <!-- Embedded mini PBL hub card -->
          <div class="post-pbl-box" style="cursor: pointer;" onclick="window.location.hash = '#pbl-hub'">
            <div class="pbl-title"><span class="iconify" data-icon="ph:lightbulb-bold"></span> Active PBL Case: Option Portfolios under Inflation</div>
            <div class="pbl-summary">Evaluating the resilience of bear-put spreads against index shocks. 3 solutions submitted. Click to view on PBL Hub.</div>
          </div>
        </div>

        <div class="post-stats">
          <span class="likes-count"><span class="iconify" data-icon="ph:thumbs-up-fill"></span> Constantijn Van Oranje and 42 others</span>
          <span>8 comments • 3 shares</span>
        </div>

        <div class="post-actions">
          <button class="action-btn"><span class="iconify" data-icon="ph:thumbs-up-bold"></span> Like</button>
          <button class="action-btn" onclick="window.location.hash = '#pbl-hub'"><span class="iconify" data-icon="ph:chat-text-bold"></span> Collaborate</button>
          <button class="action-btn"><span class="iconify" data-icon="ph:share-network-bold"></span> Share</button>
        </div>
      </article>

      <!-- POST 2: STAY CONNECTED BANNER (Official) -->
      <article class="sbe-card feed-post">
        <div class="post-header">
          <div class="author-info">
            <img src="Image_ressources/Mood_images/eukste_bezienswaardigheden_maastricht_townhouse.jpg" alt="Leann Poeth" class="avatar">
            <div class="details">
              <span class="name">Leann Poeth <span class="iconify" data-icon="ph:seal-check-fill" style="color: var(--um-orange-red);" title="Staff Alumnus"></span></span>
              <span class="headline">Alumni Relations Director at Maastricht University</span>
              <span class="time">5 hours ago • <span class="iconify" data-icon="ph:globe-hemisphere-east-bold"></span></span>
            </div>
          </div>
          <button class="options-btn" aria-label="Post Options">⋮</button>
        </div>

        <div class="post-content">
          <p>We are excited to launch the brand-new digital portal for the UniCircle Network! 🚀</p>
          <p>With more than 50,000 alumni worldwide, our goal is to build an active, engaged professional community. Whether you want to recruit UM talent, collaborate on academic Problem-Based Learning cases, or track tutorial classmate reunions at our upcoming events, stay connected! Support the platform with our Give What You Can contribution to search our complete, granular tutorial database.</p>
        </div>

        <div class="post-image">
          <img src="Image_ressources/banner_stay_connected_to_your_lifelong_global_network.png" alt="Stay connected to your lifelong global network banner">
        </div>

        <div class="post-stats">
          <span class="likes-count"><span class="iconify" data-icon="ph:thumbs-up-fill"></span> David Döbele and 108 others</span>
          <span>12 comments • 15 shares</span>
        </div>

        <div class="post-actions">
          <button class="action-btn"><span class="iconify" data-icon="ph:thumbs-up-bold"></span> Like</button>
          <button class="action-btn" onclick="window.location.hash = '#jobs'"><span class="iconify" data-icon="ph:crown-bold"></span> View Premium</button>
          <button class="action-btn"><span class="iconify" data-icon="ph:share-network-bold"></span> Share</button>
        </div>
      </article>

      <!-- DIFFERENTIATION CARD: UniCircle vs official UM Alumni portal -->
      <article class="sbe-card feed-post" style="border-left: 4px solid var(--uc-azure);">
        <div class="post-header">
          <div class="author-info">
            <img src="unicircle-logo.png" alt="UniCircle" class="avatar" style="border-radius: var(--radius-md);">
            <div class="details">
              <span class="name">UniCircle <span class="iconify" data-icon="ph:seal-check-fill" style="color: var(--uc-azure);" title="Official Platform"></span></span>
              <span class="headline">The community-built alumni layer for Maastricht University</span>
              <span class="time">Pinned • <span class="iconify" data-icon="ph:globe-hemisphere-east-bold"></span></span>
            </div>
          </div>
        </div>
        <div class="post-content">
          <p><strong>UniCircle vs. the official UM Alumni portal — what's different?</strong></p>
          <p style="font-size: var(--text-sm); line-height: 1.6; margin-top: var(--space-2);">The official UM portal is great for newsletters and university news. UniCircle was built by alumni <em>for alumni</em> — it gives you the things the official portal can't:</p>
          <ul style="margin: var(--space-3) 0 0 var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); font-size: var(--text-sm); line-height: 1.5;">
            <li><span class="iconify" data-icon="ph:map-pin-fill" style="color: var(--uc-azure);"></span> <strong>City Hubs</strong> — find UM alumni in your city and meet up</li>
            <li><span class="iconify" data-icon="ph:users-three-fill" style="color: var(--uc-azure);"></span> <strong>Cohort matching</strong> — see exactly who was in your Period & Tutorial group</li>
            <li><span class="iconify" data-icon="ph:chalkboard-teacher-fill" style="color: var(--uc-azure);"></span> <strong>Student mentoring</strong> — current UM students can reach you directly</li>
            <li><span class="iconify" data-icon="ph:calendar-check-fill" style="color: var(--uc-azure);"></span> <strong>Event attendance</strong> — see which classmates RSVP'd before you commit</li>
            <li><span class="iconify" data-icon="ph:chat-circle-dots-fill" style="color: var(--uc-azure);"></span> <strong>Direct messaging</strong> — instant 1-on-1 with any member</li>
            <li><span class="iconify" data-icon="ph:briefcase-fill" style="color: var(--uc-azure);"></span> <strong>UM-only jobs &amp; internships</strong> — post or discover UM-preferred vacancies</li>
          </ul>
          <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-top: var(--space-3);">UniCircle is independently hosted and funded by the community ("Give What You Can"). Prof. Dr. Jan M. Smits and other faculty are in conversations to co-fund at UM level.</p>
        </div>
        <div class="post-actions">
          <button class="action-btn" onclick="window.location.hash='#network'"><span class="iconify" data-icon="ph:users-three-bold"></span> Explore Network</button>
          <button class="action-btn" onclick="window.location.hash='#jobs'"><span class="iconify" data-icon="ph:heart-bold"></span> Support Platform</button>
          <button class="action-btn" onclick="window.UC && window.UC.openAuth('signup')"><span class="iconify" data-icon="ph:user-plus-bold"></span> Join UniCircle</button>
        </div>
      </article>

    </div>
  </main>

  <!-- RIGHT COLUMN: RECOMMENDATIONS & SCENIC -->
  <aside class="right-sidebar" role="complementary" aria-label="Recommendations and Spotlights">
    
    <!-- "Add to your feed" SBE Alumni Recommendations -->
    <div class="sbe-card widget-card">
      <h3 class="widget-title">Add to your feed</h3>
      <ul class="recommendation-list">
        <li class="rec-item">
          <img src="Image_ressources/University_images/csm_InformateurHOP_BalkansCat_1ac159a82c.jpg" alt="Jon Gray" class="avatar">
          <div class="info">
            <span class="name">Jon Gray</span>
            <span class="title">President & Chief Operating Officer at Carl-Square</span>
          </div>
          <button class="follow-btn" aria-label="Follow Jon Gray">+ Follow</button>
        </li>
        <li class="rec-item" style="border-top: 1px solid var(--color-border); padding-top: var(--space-2); margin-top: var(--space-2);">
          <img src="Image_ressources/University_images/unnamed.jpg" alt="Constantijn Van Oranje" class="avatar">
          <div class="info">
            <span class="name">Constantijn Van Oranje</span>
            <span class="title">Envoy at Techleap.nl | Startup SBE Lead Partner</span>
          </div>
          <button class="follow-btn" aria-label="Follow Constantijn Van Oranje">+ Follow</button>
        </li>
        <li class="rec-item" style="border-top: 1px solid var(--color-border); padding-top: var(--space-2); margin-top: var(--space-2);">
          <img src="Image_ressources/University_images/SBE.28MEI0040 2_www.lauraknipsael.com_.jpg" alt="David Döbele" class="avatar">
          <div class="info">
            <span class="name">David Döbele</span>
            <span class="title">Co-Founder @ pumpkin careers | Munich Alumni Chair</span>
          </div>
          <button class="follow-btn" aria-label="Follow David Döbele">+ Follow</button>
        </li>
      </ul>
    </div>

    <!-- Scenic Maastricht Sehenswürdigkeiten Branded Widget -->
    <div class="sbe-card scenic-card">
      <img src="Image_ressources/Mood_images/maastricht-sehenswuerdigkeiten-00.jpg" alt="Scenic Maastricht bridge and river landscape" class="scenic-image">
      <div class="overlay"></div>
      <div class="scenic-content">
        <span class="tag">Maastricht City</span>
        <h3 class="title">Maastricht Sehenswürdigkeiten</h3>
        <p style="font-size: 10px; color: oklch(1 0 0 / 0.8); margin-top: 2px;">Reconnect with the historic city where your business journey began.</p>
        <a href="#events" class="cta">
          Explore Alumni events <span class="iconify" data-icon="ph:arrow-right-bold"></span>
        </a>
      </div>
    </div>
  </aside>

</div>

<!-- NATIVE HTML5 CREATE POST MODAL DIALOG -->
<dialog id="post-modal" class="sbe-modal" aria-labelledby="post-modal-title">
  <div class="modal-wrapper">
    <div class="modal-header">
      <h3 id="post-modal-title">Create UniCircle Feed Post</h3>
      <button class="close-btn" aria-label="Close modal">✕</button>
    </div>
    <form method="dialog">
      <div class="modal-body">
        <div class="form-group">
          <label for="post-degree">Select Academic Degree Badge</label>
          <select id="post-degree" required>
            <option value="M.Sc.">M.Sc. (Master's - Red)</option>
            <option value="B.Sc.">B.Sc. (Bachelor's - Orange)</option>
            <option value="Ph.D.">Ph.D. (Doctorate - Blue)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="post-text-input">What's on your mind?</label>
          <textarea id="post-text-input" placeholder="Share a case study, problem, tutorial memory, or vacancy..." required></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="cancel-btn">Cancel</button>
        <button type="submit" class="submit-btn">Post</button>
      </div>
    </form>
  </div>
</dialog>
`,
    network: `
<div style="max-width: 1200px; margin: var(--space-6) auto; padding-inline: var(--space-4);">

  <!-- My Network Sub-Navigation Tabs -->
  <div style="display: flex; gap: var(--space-3); margin-bottom: var(--space-5); overflow-x: auto; padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border);">
    <button class="action-btn active" style="background-color: var(--um-dark-blue); color: white;" onclick="document.getElementById('network-directory').scrollIntoView({behavior: 'smooth'})">Alumni Directory</button>
    <button class="action-btn" onclick="document.getElementById('city-hubs').scrollIntoView({behavior: 'smooth'})">City Hubs</button>
    <button class="action-btn" onclick="document.getElementById('mentorship').scrollIntoView({behavior: 'smooth'})">Mentorship</button>
    <button class="action-btn" onclick="document.getElementById('guest-lectures').scrollIntoView({behavior: 'smooth'})">Guest Lectures</button>
  </div>

  <div id="network-directory">
    <!-- AI Search Container Header -->
    <div class="ai-search-container">
    <div class="ai-header">
      <span class="iconify sparkle-icon" data-icon="ph:sparkles-duotone"></span>
      <div>
        <h3>AI-Powered Connections Finder</h3>
        <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-top: 2px;">
          Ask our database anything naturally or refine your exact tutorial peer groups using the structured controllers below.
        </p>
      </div>
    </div>

    <!-- Conversational query box -->
    <div class="search-bar-wrapper">
      <input type="search" class="search-input" placeholder="e.g. 'Show me alumni in Consulting from International Financial Management Period 5 Tutorial 01'..." aria-label="Conversational AI Alumni Search">
      <button class="search-submit" aria-label="Run Search">Search</button>
    </div>

    <!-- Clickable conversation starters -->
    <div class="filter-suggestions">
      <span style="font-size: 10px; color: var(--color-text-muted); align-self: center; font-weight: 600;">Try searching:</span>
      <span class="tag">"Finance peers from Period 5"</span>
      <span class="tag">"McKinsey consultants in Consulting"</span>
      <span class="tag">"International Financial Management Tutorial 01"</span>
      <span class="tag">"Tech experts at Binance"</span>
    </div>
  </div>

  <!-- Structured Academic & Sector Filters -->
  <div class="sbe-card" style="padding: var(--space-5); margin-bottom: var(--space-6);">
    <h4 style="margin-bottom: var(--space-4); border-bottom: 2px solid var(--um-light-blue); padding-bottom: var(--space-2);">Granular Database Filters</h4>
    
    <div class="grid-filter-controls">
      
      <!-- Sector/Industry Dropdown -->
      <div class="filter-group">
        <label for="filter-sector">Industry Sector</label>
        <select id="filter-sector" aria-label="Filter by Sector">
          <option value="">All Sectors</option>
          <option value="Finance">Finance / Investment Banking</option>
          <option value="Consulting">Management Consulting</option>
          <option value="Tech">Technology / Startups</option>
        </select>
      </div>

      <!-- Course Selection Dropdown -->
      <div class="filter-group">
        <label for="filter-course">Course Taken</label>
        <select id="filter-course" aria-label="Filter by Course">
          <option value="">All UM Courses</option>
          <option value="International Financial Management">International Financial Management</option>
          <option value="Problem Based Learning in Finance">Problem Based Learning in Finance</option>
          <option value="Quantitative Modeling">Quantitative Modeling</option>
          <option value="Marketing Strategy">Marketing Strategy</option>
        </select>
      </div>

      <!-- SBE Academic Period Dropdown -->
      <div class="filter-group">
        <label for="filter-period">Academic Period</label>
        <select id="filter-period" aria-label="Filter by Period">
          <option value="">All Periods (1-6)</option>
          <option value="1">Period 1</option>
          <option value="2">Period 2</option>
          <option value="4">Period 4</option>
          <option value="5">Period 5</option>
        </select>
      </div>

      <!-- Tutorial Group Dropdown -->
      <div class="filter-group">
        <label for="filter-tutorial">Tutorial Number</label>
        <select id="filter-tutorial" aria-label="Filter by Tutorial Group">
          <option value="">All Tutorial Groups</option>
          <option value="01">Tutorial 01</option>
          <option value="02">Tutorial 02</option>
          <option value="03">Tutorial 03</option>
          <option value="04">Tutorial 04</option>
        </select>
      </div>

      <!-- Graduation Year Dropdown -->
      <div class="filter-group">
        <label for="filter-year">Graduation Year</label>
        <select id="filter-year" aria-label="Filter by Graduation Year">
          <option value="">All Years</option>
          <option value="2025">Class of 2025</option>
          <option value="2024">Class of 2024</option>
          <option value="2023">Class of 2023</option>
          <option value="2022">Class of 2022</option>
          <option value="2021">Class of 2021</option>
        </select>
      </div>

    </div>
  </div>

  <!-- Alumni Search Results Title -->
  <div style="margin-bottom: var(--space-4);">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800;">Alumni Search Results <span style="font-weight: 500; font-size: var(--text-xs); color: var(--color-text-muted);">(Showing database matches)</span></h3>
  </div>

  <!-- Dynamic Alumni Profile Grid -->
  <div class="alumni-grid">
    
    <!-- CARD 1: OVERLAP MATCH (Binance) -->
    <article class="sbe-card alumni-card premium-border" data-sector="Tech" data-course="International Financial Management" data-period="5" data-tutorial="01" data-year="2024">
      <span class="premium-ribbon">Premium</span>
      <div class="card-header">
        <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="Linas Beliūnas avatar" class="avatar">
        <div class="basics">
          <h4 class="name">Linas Beliūnas <span class="iconify" data-icon="ph:seal-check-fill" style="color: var(--um-orange-red);" title="Verified Alumnus"></span></h4>
          <span class="degree">M.Sc. Econometrics ('24)</span>
        </div>
      </div>
      <div class="card-body">
        <p class="headline">Risk Strategy Architect at Binance | Fintech Innovator</p>
        <p class="meta-details">
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> Tech Sector</span>
          <span><span class="iconify" data-icon="ph:buildings-bold"></span> Binance HQ, Amsterdam</span>
        </p>
        <!-- Overlay Academic Match Highlight -->
        <div class="academic-overlap">
          <span class="iconify" data-icon="ph:sparkles-bold"></span> Classmate Overlap: IFM Tutorial 01
        </div>
      </div>
      <div class="card-footer">
        <button class="connect-btn">Connect</button>
        <button class="pbl-btn">Invite to Solve</button>
      </div>
    </article>

    <!-- CARD 2: OVERLAP MATCH (KPMG) -->
    <article class="sbe-card alumni-card" data-sector="Consulting" data-course="International Financial Management" data-period="5" data-tutorial="01" data-year="2024">
      <div class="card-header">
        <img src="Image_ressources/Mood_images/images-maastricht.jpg" alt="Sophie van der Meer avatar" class="avatar">
        <div class="basics">
          <h4 class="name">Sophie van der Meer</h4>
          <span class="degree">M.Sc. Financial Economics ('24)</span>
        </div>
      </div>
      <div class="card-body">
        <p class="headline">Corporate Finance Associate at KPMG Netherlands</p>
        <p class="meta-details">
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> Consulting Sector</span>
          <span><span class="iconify" data-icon="ph:buildings-bold"></span> KPMG offices, Eindhoven</span>
        </p>
        <div class="academic-overlap">
          <span class="iconify" data-icon="ph:sparkles-bold"></span> Classmate Overlap: IFM Tutorial 01
        </div>
      </div>
      <div class="card-footer">
        <button class="connect-btn">Connect</button>
        <button class="pbl-btn">Invite to Solve</button>
      </div>
    </article>

    <!-- CARD 3: FINANCE MATCH (Goldman Sachs) -->
    <article class="sbe-card alumni-card" data-sector="Finance" data-course="Quantitative Modeling" data-period="1" data-tutorial="04" data-year="2023">
      <div class="card-header">
        <img src="Image_ressources/Mood_images/u1168774368_Postwar_memorial_at_the_Bendlerblock_courtyard_empt_9e42e39d-28da-4694-8b76-f1a601363b88.png" alt="Lucas Hesselink avatar" class="avatar">
        <div class="basics">
          <h4 class="name">Lucas Hesselink</h4>
          <span class="degree">M.Sc. Financial Economics ('23)</span>
        </div>
      </div>
      <div class="card-body">
        <p class="headline">Investment Banking Analyst at Goldman Sachs</p>
        <p class="meta-details">
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> Finance Sector</span>
          <span><span class="iconify" data-icon="ph:buildings-bold"></span> Goldman Sachs, London Branch</span>
        </p>
      </div>
      <div class="card-footer">
        <button class="connect-btn">Connect</button>
        <button class="pbl-btn">Invite to Solve</button>
      </div>
    </article>

    <!-- CARD 4: TECH MATCH (Booking.com) -->
    <article class="sbe-card alumni-card" data-sector="Tech" data-course="Problem Based Learning in Finance" data-period="2" data-tutorial="02" data-year="2025">
      <div class="card-header">
        <img src="Image_ressources/Mood_images/1688546451_Maastricht-Ueberblick.jpg" alt="Elena Rostova avatar" class="avatar">
        <div class="basics">
          <h4 class="name">Elena Rostova</h4>
          <span class="degree">B.Sc. International Business ('25)</span>
        </div>
      </div>
      <div class="card-body">
        <p class="headline">Junior Product Specialist at Booking.com | Agile Practitioner</p>
        <p class="meta-details">
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> Tech Sector</span>
          <span><span class="iconify" data-icon="ph:buildings-bold"></span> Booking.com HQ, Amsterdam</span>
        </p>
      </div>
      <div class="card-footer">
        <button class="connect-btn">Connect</button>
        <button class="pbl-btn">Invite to Solve</button>
      </div>
    </article>

    <!-- CARD 5: CONSULTING MATCH (McKinsey) -->
    <article class="sbe-card alumni-card" data-sector="Consulting" data-course="Marketing Strategy" data-period="4" data-tutorial="03" data-year="2023">
      <div class="card-header">
        <img src="Image_ressources/Mood_images/maastricht_012_innenstadt.jpg" alt="Thomas Klein avatar" class="avatar">
        <div class="basics">
          <h4 class="name">Thomas Klein <span class="iconify" data-icon="ph:seal-check-fill" style="color: var(--um-light-blue);" title="Verified Alumnus"></span></h4>
          <span class="degree">M.Sc. Corporate Governance ('23)</span>
        </div>
      </div>
      <div class="card-body">
        <p class="headline">Strategic Management Consultant at McKinsey & Company</p>
        <p class="meta-details">
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> Consulting Sector</span>
          <span><span class="iconify" data-icon="ph:buildings-bold"></span> McKinsey offices, Munich</span>
        </p>
      </div>
      <div class="card-footer">
        <button class="connect-btn">Connect</button>
        <button class="pbl-btn">Invite to Solve</button>
      </div>
    </article>

  </div>
  </div>

  <hr style="margin: var(--space-6) 0; border: none; height: 1px; background-color: var(--color-border);">

  <!-- City Alumni Hubs -->
  <div id="city-hubs" style="margin-bottom: var(--space-6); scroll-margin-top: 100px;">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800; margin-bottom: var(--space-4);">City Alumni Hubs <span style="font-weight: 500; font-size: var(--text-xs); color: var(--color-text-muted);">(Connect locally)</span></h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-4);">
      <div class="sbe-card" style="padding: var(--space-4);">
        <h4 style="font-size: var(--text-sm); font-weight: 700; margin-bottom: var(--space-2);"><span class="iconify" data-icon="ph:map-pin-fill" style="color: var(--um-orange-red);"></span> Munich, Germany</h4>
        <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3);">3,420 UniCircle members • Led by David Döbele</p>
        <div style="display: flex; gap: -10px; margin-bottom: var(--space-3);">
          <img src="Image_ressources/University_images/SBE.28MEI0040 2_www.lauraknipsael.com_.jpg" style="width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; z-index: 3;" alt="Member">
          <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" style="width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; z-index: 2; margin-left: -10px;" alt="Member">
          <div style="width: 30px; height: 30px; border-radius: 50%; background: var(--color-surface-hover); border: 2px solid white; z-index: 1; margin-left: -10px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;">+3k</div>
        </div>
        <button class="connect-btn" style="width: 100%;">Join Munich Hub</button>
      </div>
      <div class="sbe-card" style="padding: var(--space-4);">
        <h4 style="font-size: var(--text-sm); font-weight: 700; margin-bottom: var(--space-2);"><span class="iconify" data-icon="ph:map-pin-fill" style="color: var(--um-orange-red);"></span> London, UK</h4>
        <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3);">2,850 UniCircle members • Financial District</p>
        <button class="connect-btn" style="width: 100%;">Join London Hub</button>
      </div>
      <div class="sbe-card" style="padding: var(--space-4);">
        <h4 style="font-size: var(--text-sm); font-weight: 700; margin-bottom: var(--space-2);"><span class="iconify" data-icon="ph:map-pin-fill" style="color: var(--um-orange-red);"></span> Amsterdam, NL</h4>
        <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3);">5,100 UniCircle members • Zuidas Hub</p>
        <button class="connect-btn" style="width: 100%;">Join Amsterdam Hub</button>
      </div>
    </div>
  </div>

  <hr style="margin: var(--space-6) 0; border: none; height: 1px; background-color: var(--color-border);">

  <!-- Mentorship -->
  <div id="mentorship" style="margin-bottom: var(--space-6); scroll-margin-top: 100px;">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800; margin-bottom: var(--space-4);">UM Mentorship Exchange</h3>
    <div style="display: flex; flex-wrap: wrap; gap: var(--space-4);">
      <div class="sbe-card" style="flex: 1; min-width: 300px; background: linear-gradient(135deg, var(--um-dark-blue) 0%, var(--um-light-blue) 100%); color: white; border: none;">
        <h4 style="color: white; margin-bottom: var(--space-2);">Are you a current student?</h4>
        <p style="font-size: var(--text-xs); opacity: 0.9; margin-bottom: var(--space-4);">Connect with experienced UniCircle members for career guidance, internship advice, and resume reviews.</p>
        <button style="background: white; color: var(--um-dark-blue); border: none; padding: 8px 16px; border-radius: 20px; font-weight: 600; cursor: pointer;">Find a Mentor</button>
      </div>
      <div class="sbe-card" style="flex: 1; min-width: 300px; border-left: 4px solid var(--um-orange-red);">
        <h4 style="margin-bottom: var(--space-2);">Give back to UM</h4>
        <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-4);">Help the next generation of UM graduates. Offer 1-on-1 mentorship or quick resume reviews.</p>
        <button class="connect-btn">Become a Mentor</button>
      </div>
    </div>
    <!-- Sample Mentors -->
    <div style="margin-top: var(--space-4);">
      <h4 style="font-size: var(--text-sm); font-weight: 700; margin-bottom: var(--space-3);">Available Mentors</h4>
      <div class="alumni-grid">
        <article class="sbe-card alumni-card" style="display: flex; flex-direction: column;">
          <div class="card-header">
            <img src="Image_ressources/Mood_images/images-maastricht.jpg" alt="Sophie van der Meer avatar" class="avatar">
            <div class="basics">
              <h4 class="name">Sophie van der Meer</h4>
              <span class="degree">Consulting Mentor</span>
            </div>
          </div>
          <div class="card-body">
            <p class="headline">Corporate Finance at KPMG</p>
            <p class="meta-details" style="font-size: 10px; margin-top: 8px;">Offering: CV Review, Interview Prep</p>
          </div>
          <div class="card-footer" style="margin-top: auto;">
            <button class="connect-btn" style="width: 100%;">Request Mentorship</button>
          </div>
        </article>
      </div>
    </div>
  </div>

  <hr style="margin: var(--space-6) 0; border: none; height: 1px; background-color: var(--color-border);">

  <!-- Guest Lectures -->
  <div id="guest-lectures" style="margin-bottom: var(--space-6); scroll-margin-top: 100px;">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800; margin-bottom: var(--space-4);">Guest Lecture Board</h3>
    <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-4);">UM lecturers regularly seek industry experts to enrich the curriculum. Alumni can volunteer their expertise for upcoming courses.</p>
    
    <div style="display: grid; gap: var(--space-4);">
      <article class="sbe-card" style="padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <span style="font-size: 10px; font-weight: 700; color: var(--um-orange-red); text-transform: uppercase; letter-spacing: 0.5px;">Seeking Speaker</span>
            <h4 style="font-size: var(--text-sm); font-weight: 700; margin-top: 4px;">Real-world impacts of AI in FinTech</h4>
            <p style="font-size: 12px; color: var(--color-text-secondary);">Course: Technology & Innovation Management • Nov 2026</p>
          </div>
          <img src="Image_ressources/Mood_images/eukste_bezienswaardigheden_maastricht_townhouse.jpg" alt="Prof" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
        </div>
        <p style="font-size: var(--text-xs); line-height: 1.5;">We are looking for an alumnus working in FinTech or Banking to discuss how AI is altering risk assessment models. Estimated commitment: 1 hour online lecture + Q&A.</p>
        <div style="display: flex; gap: var(--space-2); margin-top: auto;">
          <button class="connect-btn">Volunteer to Speak</button>
        </div>
      </article>
    </div>
  </div>

</div>

<!-- NATIVE HTML5 INVITE ALUMNI TO CASE MODAL -->
<dialog id="invite-modal" class="sbe-modal" aria-labelledby="invite-modal-title">
  <div class="modal-wrapper">
    <div class="modal-header">
      <h3 id="invite-modal-title">Invite Alumnus to Solve PBL Case</h3>
      <button class="close-btn" aria-label="Close modal">✕</button>
    </div>
    <form method="dialog">
      <div class="modal-body">
        <p style="font-size: var(--text-xs); color: var(--color-text-secondary); margin-bottom: var(--space-3);">
          You are inviting <strong class="invitee-name" style="color: var(--um-dark-blue);">Alumni</strong> to cooperate and review your active Problem-Based Learning case.
        </p>
        <div class="form-group">
          <label for="select-pbl-case">Choose Your Active Case Study</label>
          <select id="select-pbl-case" required>
            <option value="1">Option Portfolios under Inflation (International Financial Management)</option>
            <option value="2">Evaluation of Startup valuations in local Dutch Markets (Corporate Strategy)</option>
            <option value="3">Quantitative risk parameters under extreme asset shifts (Econometrics)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="invite-memo">Add a Personal Note</label>
          <textarea id="invite-memo" placeholder="Hi! I loved our discussions back in Tutorial 01. I would value your real-world expertise on this case..." required></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="cancel-btn">Back</button>
        <button type="submit" class="submit-btn">Send Invitation</button>
      </div>
    </form>
  </div>
</dialog>
`,
    'pbl-hub': `
<div style="max-width: 1200px; margin: var(--space-6) auto; padding-inline: var(--space-4);">
  
  <!-- PBL Hub Header Intro -->
  <div class="pbl-hub-header">
    <div class="pbl-hub-intro">
      <h2>Problem-Based Learning Hub</h2>
      <p>
        In SBE, we learn by solving problems together. The PBL Hub extends Maastricht's core methodology to the professional world. Students submit complex academic or industrial case studies, and alumni collaborate to deliver real-world answers.
      </p>
    </div>
    <div class="pbl-action">
      <button class="pbl-create-btn" aria-label="Submit a Case Study">
        <span class="iconify" data-icon="ph:plus-bold"></span> Post SBE Case
      </button>
    </div>
  </div>

  <!-- PBL Active Cases List -->
  <div class="pbl-cases-list">
    
    <!-- CASE 1: INTERNATIONAL FINANCIAL MANAGEMENT -->
    <article class="sbe-card pbl-case-card">
      <div class="case-header">
        <span class="course-tag">International Financial Management</span>
        <span class="difficulty-rating">
          <span class="iconify" data-icon="ph:star-fill"></span>
          <span class="iconify" data-icon="ph:star-fill"></span>
          <span class="iconify" data-icon="ph:star-fill"></span>
          <span style="margin-left: 4px;">Advanced Risk</span>
        </span>
      </div>

      <h3 class="case-title">Evaluating Option Portfolio Hedging Resilience Against Index Shocks</h3>
      
      <div class="case-author">
        <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Jean Maurice avatar">
        <span>Submitted by <span class="author-name">Jean Maurice H.</span> (Current M.Sc. Student) • Period 5 Tutorial 01</span>
      </div>

      <p class="case-description">
        In our recent IFM tutorial, we debated the efficiency of bear-put options spreads to hedge portfolio equity drawdowns during sudden European Central Bank interest rate adjustments. Under high-volatility shifts, standard delta hedging breaks down. How do practicing financial risk analysts adjust their gamma and vega sensitivities to maintain structural portfolio defense without eroding excessive margin yield? We would value SBE risk mentors' insights!
      </p>

      <div class="case-stats">
        <span class="active-solutions"><span class="iconify" data-icon="ph:chat-text-bold"></span> 2 solutions proposed by Alumni</span>
        <span><span class="iconify" data-icon="ph:eye-bold"></span> 84 alumni viewed</span>
      </div>

      <!-- Solutions Sub-Panel -->
      <div class="case-solutions-preview">
        <h4 style="font-size: var(--text-xs); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Mentors Discussion</h4>
        
        <!-- Solution 1 -->
        <div class="solution-item">
          <!-- Upvote Count Widget -->
          <div class="upvote-widget" role="button" aria-label="Upvote this solution" tabindex="0">
            <span class="iconify" data-icon="ph:caret-up-bold"></span>
            <span class="count">28</span>
          </div>
          <div class="solution-body">
            <div class="solution-meta">
              <strong>Ruben Hassid</strong> (Senior Portfolio Risk Architect)
              <span class="mentor-badge">UniCircle Gold Mentor</span>
              • 1 hour ago
            </div>
            <p class="solution-text">
              Great question, Jean! In active trading desks, relying strictly on delta-gamma neutral modeling fails during ECB index shocks due to extreme "volatility smiles" (vega drift). We solve this by over-hedging the out-of-the-money vega components (purchasing further OTM puts) and scaling into dynamic ratio spreads. This creates a net vega-positive posture that appreciates when systemic volatility spikes, protecting the overall asset block while keeping premium costs low.
            </p>
          </div>
        </div>

        <!-- Solution 2 -->
        <div class="solution-item" style="margin-top: var(--space-2);">
          <div class="upvote-widget" role="button" aria-label="Upvote this solution" tabindex="0">
            <span class="iconify" data-icon="ph:caret-up-bold"></span>
            <span class="count">14</span>
          </div>
          <div class="solution-body">
            <div class="solution-meta">
              <strong>Linas Beliūnas</strong> (Risk Strategy Architect at Binance)
              <span class="mentor-badge">UM Alumnus</span>
              • 30 mins ago
            </div>
            <p class="solution-text">
              I agree with Ruben's strategy. At Binance, we look at volatility spikes with severe tail-risk metrics. Delta-neutral rebalancing on a fixed timetable is suicide during index shock runs. You should incorporate threshold-based triggers (e.g. rebalance only if the underlying moves by more than 1.5 standard deviations) rather than fixed-time schedules. This prevents over-trading fees and retains defensive coverage when liquidity dries up.
            </p>
          </div>
        </div>
      </div>
    </article>

    <!-- CASE 2 -->
    <article class="sbe-card pbl-case-card">
      <div class="case-header">
        <span class="course-tag">Problem Based Learning in Finance</span>
        <span class="difficulty-rating">
          <span class="iconify" data-icon="ph:star-fill"></span>
          <span class="iconify" data-icon="ph:star-fill"></span>
          <span style="margin-left: 4px;">Intermediate</span>
        </span>
      </div>

      <h3 class="case-title">Valuation Metrics for Tech Startups Under Hyper-Inflationary Squeezes</h3>
      
      <div class="case-author">
        <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="Elena Rostova avatar">
        <span>Submitted by <span class="author-name">Elena Rostova</span> (Current B.Sc. Student) • Period 2 Tutorial 02</span>
      </div>

      <p class="case-description">
        Standard Discounted Cash Flow (DCF) models assume relatively stable cost profiles. However, startup valuations in the local Dutch market are currently facing soaring wage and capital costs. SBE risk groups are debating if Multiples valuation (EV/ARR) remains a reliable anchor, or if we should pivot to Option Pricing Models (OPM) to capture the flexibilities of early-stage software companies. We invite SBE venture capital specialists to guide us!
      </p>

      <div class="case-stats">
        <span class="active-solutions"><span class="iconify" data-icon="ph:chat-text-bold"></span> 1 solution proposed by Alumni</span>
        <span><span class="iconify" data-icon="ph:eye-bold"></span> 52 alumni viewed</span>
      </div>

      <div class="case-solutions-preview">
        <h4 style="font-size: var(--text-xs); color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--space-1);">Mentors Discussion</h4>
        
        <!-- Solution 1 -->
        <div class="solution-item">
          <div class="upvote-widget" role="button" aria-label="Upvote this solution" tabindex="0">
            <span class="iconify" data-icon="ph:caret-up-bold"></span>
            <span class="count">19</span>
          </div>
          <div class="solution-body">
            <div class="solution-meta">
              <strong>Sophie van der Meer</strong> (Corporate Finance Associate at KPMG)
              <span class="mentor-badge">UM Alumnus</span>
              • 3 hours ago
            </div>
            <p class="solution-text">
              Great debate topic, Elena! Standard EV/ARR multiples can be highly deceptive during inflationary peaks because capital costs squeeze terminal valuations. At KPMG, we currently blend the OPM (Option Pricing Model) to value operational flexibilities, but heavily discount the final multiples by an inflationary risk index (around 15-20% haircuts). DCF is only useful if you stress-test the WACC above 12% to reflect high debt cost.
            </p>
          </div>
        </div>
      </div>
    </article>

  </div>
</div>

<!-- NATIVE HTML5 SUBMIT PBL CASE MODAL -->
<dialog id="pbl-create-modal" class="sbe-modal" aria-labelledby="pbl-modal-title">
  <div class="modal-wrapper">
    <div class="modal-header">
      <h3 id="pbl-modal-title">Post SBE PBL Case Challenge</h3>
      <button class="close-btn" aria-label="Close modal">✕</button>
    </div>
    <form method="dialog">
      <div class="modal-body">
        <div class="form-group">
          <label for="case-title-input">Problem Case Title</label>
          <input type="text" id="case-title-input" placeholder="e.g. Stress-Testing Hedging Strategies under ECB Interest Shifts" required>
        </div>
        <div class="form-group">
          <label for="case-course-input">Target SBE Course</label>
          <select id="case-course-input" required>
            <option value="International Financial Management">International Financial Management</option>
            <option value="Problem Based Learning in Finance">Problem Based Learning in Finance</option>
            <option value="Quantitative Modeling">Quantitative Modeling</option>
            <option value="Marketing Strategy">Marketing Strategy</option>
          </select>
        </div>
        <div class="form-group">
          <label for="case-desc-input">Detailed Case Description</label>
          <textarea id="case-desc-input" placeholder="Outline the quantitative parameters, the tutorial debate questions, and where you seek SBE Alumni guidance..." required></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="cancel-btn">Cancel</button>
        <button type="submit" class="submit-btn">Submit Case</button>
      </div>
    </form>
  </div>
</dialog>
`,
    events: `
<div style="max-width: 1200px; margin: var(--space-6) auto; padding-inline: var(--space-4);">
  
  <!-- Events Intro Banner -->
  <div class="sbe-card" style="padding: var(--space-5); margin-bottom: var(--space-6); background: linear-gradient(135deg, var(--um-dark-blue) 0%, var(--um-light-blue) 100%); color: white; border: none;">
    <h2 style="font-family: var(--font-heading); color: white; font-size: var(--text-2xl); font-weight: 800;">UM Networking Events</h2>
    <p style="font-size: var(--text-sm); color: oklch(1 0 0 / 0.85); margin-top: var(--space-2); line-height: 1.4; max-width: 800px;">
      Never attend an event alone. Our <strong>See Who Is Coming</strong> feature highlights which former classmates from your specific academic courses, periods, and tutorial sections are going, along with a full list of attending UniCircle members. Find old friends and expand your network.
    </p>
  </div>

  <!-- Events List Title -->
  <div style="margin-bottom: var(--space-4);">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800;">Upcoming Alumni Events</h3>
  </div>

  <!-- Events Roster Grid -->
  <div class="events-roster-list">
    
    <!-- EVENT 1: MUNICH MEETUP -->
    <article class="sbe-card event-card">
      <div class="event-date-side">
        <span class="day">18</span>
        <span class="month">Jun</span>
        <span class="year">2026</span>
      </div>

      <div class="event-details-side">
        <span class="event-location"><span class="iconify" data-icon="ph:map-pin-fill"></span> Munich, Germany</span>
        <h3 class="event-title">Munich UniCircle Regional Meetup</h3>
        <p class="event-description">
          Hosted by David Döbele at the Hofbräuhaus München. With over 3,000 Maastricht alumni based around Munich, join us to catch up on old times, expand your professional UM network, and discuss regional career opportunities.
        </p>

        <!-- Classmate Overlap tracker pill -->
        <div class="tutorial-overlap-pill" title="Click to view classmate details" aria-label="3 classmates attending. Click to view.">
          <div class="avatars-stack">
            <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="Classmate 1 avatar">
            <img src="Image_ressources/Mood_images/images-maastricht.jpg" alt="Classmate 2 avatar">
            <img src="Image_ressources/Mood_images/eukste_bezienswaardigheden_maastricht_townhouse.jpg" alt="Classmate 3 avatar">
          </div>
          <div class="overlap-text">
            <span>3 classmates</span> from your Period 5 Tutorial 01 are attending, plus 142 other alumni!
          </div>
        </div>
      </div>

      <div class="event-actions-side">
        <button class="attend-btn">RSVP</button>
        <button class="details-btn">Event Details</button>
      </div>
    </article>

    <!-- EVENT 2: LONDON FINANCE NIGHT -->
    <article class="sbe-card event-card">
      <div class="event-date-side">
        <span class="day">02</span>
        <span class="month">Jul</span>
        <span class="year">2026</span>
      </div>

      <div class="event-details-side">
        <span class="event-location"><span class="iconify" data-icon="ph:map-pin-fill"></span> London, United Kingdom</span>
        <h3 class="event-title">UM London Finance Network Night</h3>
        <p class="event-description">
          An exclusive financial gathering for SBE Alumni based in London, taking place at The Ned. Excellent chance to discuss asset management, investment banking strategies, and econometric modeling. Special panel lead by Carl-Square partners.
        </p>

        <!-- Classmate Overlap tracker pill -->
        <div class="tutorial-overlap-pill" title="Click to view classmate details" aria-label="1 classmate attending. Click to view.">
          <div class="avatars-stack">
            <img src="Image_ressources/Mood_images/u1168774368_Postwar_memorial_at_the_Bendlerblock_courtyard_empt_9e42e39d-28da-4694-8b76-f1a601363b88.png" alt="Classmate 1 avatar">
          </div>
          <div class="overlap-text">
            <span>1 classmate</span> from your Period 1 Tutorial 04 is attending!
          </div>
        </div>
      </div>

      <div class="event-actions-side">
        <button class="attend-btn">RSVP</button>
        <button class="details-btn">Event Details</button>
      </div>
    </article>

    <!-- EVENT 3: MAASTRICHT REUNION GALA -->
    <article class="sbe-card event-card">
      <div class="event-date-side">
        <span class="day">25</span>
        <span class="month">Sep</span>
        <span class="year">2026</span>
      </div>

      <div class="event-details-side">
        <span class="event-location"><span class="iconify" data-icon="ph:map-pin-fill"></span> Maastricht, Netherlands</span>
        <h3 class="event-title">UM Maastricht Homecoming Reunion Gala 2026</h3>
        <p class="event-description">
          Reunite where it all started! Join us on the Tapijn SBE campus for the annual Homecoming Dinner and Gala. Meet faculty members, explore the newly expanded classrooms, and network with over 500 alumni across all generations.
        </p>

        <!-- Classmate Overlap tracker pill -->
        <div class="tutorial-overlap-pill" title="Click to view classmate details" aria-label="2 classmates attending. Click to view.">
          <div class="avatars-stack">
            <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="Classmate 1 avatar">
            <img src="Image_ressources/Mood_images/images-maastricht.jpg" alt="Classmate 2 avatar">
          </div>
          <div class="overlap-text">
            <span>2 classmates</span> from your Period 5 Tutorial 01 are attending!
          </div>
        </div>
      </div>

      <div class="event-actions-side">
        <button class="attend-btn">RSVP</button>
        <button class="details-btn">Event Details</button>
      </div>
    </article>

  </div>
</div>

<!-- NATIVE HTML5 OVERLAPPING CLASSMATES MODAL -->
<dialog id="overlap-modal" class="sbe-modal" aria-labelledby="overlap-modal-title">
  <div class="modal-wrapper">
    <div class="modal-header">
      <h3 id="overlap-modal-title">Classmate Overlap Details</h3>
      <button class="close-btn" aria-label="Close modal">✕</button>
    </div>
    <div class="modal-body" style="display: flex; flex-direction: column; gap: var(--space-4);">
      <p style="font-size: var(--text-xs); color: var(--color-text-secondary);">
        The following UniCircle members from your exact <strong>Period 5 Tutorial 01 (International Financial Management)</strong> are registered to attend this event:
      </p>
      
      <!-- Classmate list -->
      <ul style="display: flex; flex-direction: column; gap: var(--space-3);">
        <li style="display: flex; align-items: center; gap: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border);">
          <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="Linas Beliūnas" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
          <div style="flex: 1;">
            <h4 style="font-size: var(--text-xs); font-weight: 700;">Linas Beliūnas</h4>
            <p style="font-size: 10px; color: var(--color-text-secondary);">Risk Strategy Architect at Binance</p>
          </div>
          <button onclick="window.location.hash='#network'; document.getElementById('overlap-modal').close();" style="background-color: var(--um-light-blue); color: white; border: none; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; cursor: pointer;">View</button>
        </li>
        <li style="display: flex; align-items: center; gap: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--color-border);">
          <img src="Image_ressources/Mood_images/images-maastricht.jpg" alt="Sophie van der Meer" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
          <div style="flex: 1;">
            <h4 style="font-size: var(--text-xs); font-weight: 700;">Sophie van der Meer</h4>
            <p style="font-size: 10px; color: var(--color-text-secondary);">Corporate Finance Associate at KPMG</p>
          </div>
          <button onclick="window.location.hash='#network'; document.getElementById('overlap-modal').close();" style="background-color: var(--um-light-blue); color: white; border: none; padding: 4px 10px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; cursor: pointer;">View</button>
        </li>
      </ul>
      
      <p style="font-size: 10px; color: var(--um-orange-red); font-weight: 600; text-align: center;">
        Coordinate a coffee meetup in advance via direct messages!
      </p>
    </div>
    <div class="modal-footer">
      <button class="close-btn-footer cancel-btn">Close</button>
    </div>
  </div>
</dialog>
`,
    jobs: `
<div style="max-width: 1200px; margin: var(--space-6) auto; padding-inline: var(--space-4);">
  
  <!-- Carl-Square Partnership Spotlight -->
  <div class="sbe-card partner-banner">
    <!-- Visual Carl-Square Branded SVG -->
    <svg class="partner-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" aria-label="Carl Square Logo" role="img" style="width: 80px;">
      <rect width="100%" height="100%" fill="none"/>
      <!-- Creative corporate branding geometric concept -->
      <polygon points="10,10 30,10 20,30" fill="var(--um-dark-blue)" />
      <rect x="25" y="10" width="10" height="20" fill="var(--um-orange-red)" />
      <text x="40" y="26" font-family="'Outfit', sans-serif" font-size="12" font-weight="800" fill="var(--um-dark-blue)">CARL</text>
      <text x="40" y="36" font-family="'Inter', sans-serif" font-size="8" font-weight="700" fill="var(--um-light-blue)">SQUARE</text>
    </svg>
    
    <div class="partner-text">
      <h4>Official UM Career Partner: Carl Square</h4>
      <p>
        Carl Square is a leading global technology investment bank. Through our exclusive academic partnership, UniCircle members get priority career access, exclusive internships, and senior placement vacancies.
      </p>
    </div>
  </div>

  <!-- Job Openings Header -->
  <div style="margin-bottom: var(--space-4);">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800;">Featured UM Opportunities & Internships</h3>
  </div>

  <!-- Vacancy List -->
  <div class="jobs-list" style="margin-bottom: var(--space-8);">
    
    <!-- JOB 1 -->
    <article class="sbe-card job-card">
      <div class="job-logo">
        <span class="iconify" data-icon="ph:chart-line-up-bold" style="font-size: 24px; color: var(--um-orange-red);"></span>
      </div>
      <div class="job-info">
        <h4 class="title">Risk Strategy Analyst Intern</h4>
        <span class="company">Carl Square • Corporate Finance</span>
        <div class="meta-row">
          <span><span class="iconify" data-icon="ph:map-pin-bold"></span> Munich, Germany</span>
          <span><span class="iconify" data-icon="ph:clock-bold"></span> Full-Time Internship (6 months)</span>
          <span><span class="iconify" data-icon="ph:graduation-cap-bold"></span> Current UM Students & Alumni</span>
        </div>
      </div>
      <button class="apply-btn" aria-label="Apply to Risk Strategy Analyst Intern position">Quick Apply</button>
    </article>

    <!-- JOB 2 -->
    <article class="sbe-card job-card">
      <div class="job-logo">
        <span class="iconify" data-icon="ph:coins-bold" style="font-size: 24px; color: var(--um-dark-blue);"></span>
      </div>
      <div class="job-info">
        <h4 class="title">Corporate M&A Senior Associate</h4>
        <span class="company">Carl Square • M&A Advisory</span>
        <div class="meta-row">
          <span><span class="iconify" data-icon="ph:map-pin-bold"></span> Amsterdam, Netherlands</span>
          <span><span class="iconify" data-icon="ph:clock-bold"></span> Permanent Contract</span>
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> 2-4 Years experience</span>
        </div>
      </div>
      <button class="apply-btn" aria-label="Apply to Corporate M&A Senior Associate position">Quick Apply</button>
    </article>

    <!-- JOB 3 -->
    <article class="sbe-card job-card">
      <div class="job-logo">
        <span class="iconify" data-icon="ph:rocket-launch-bold" style="font-size: 24px; color: var(--um-light-blue);"></span>
      </div>
      <div class="job-info">
        <h4 class="title">Technology Investment Director</h4>
        <span class="company">Carl Square • Growth Capital</span>
        <div class="meta-row">
          <span><span class="iconify" data-icon="ph:map-pin-bold"></span> London, United Kingdom</span>
          <span><span class="iconify" data-icon="ph:clock-bold"></span> Permanent Contract</span>
          <span><span class="iconify" data-icon="ph:briefcase-bold"></span> Senior Executive Level</span>
        </div>
      </div>
      <button class="apply-btn" aria-label="Apply to Technology Investment Director position">Apply Now</button>
    </article>

  </div>

  <!-- Subscription Tiers Section -->
  <div class="premium-tiers-container">
    <div class="tiers-headline">
      <h3>Support the UniCircle Platform</h3>
      <p>
        Help us maintain and grow this independent UniCircle digital infrastructure. 
        We rely on a "Give what you can" model to keep our community fully connected, ensuring higher University funding isn't our only crutch.
      </p>
    </div>

    <div class="tiers-grid">
      
      <!-- Tier 1: Free -->
      <section class="sbe-card tier-card" aria-labelledby="basic-tier-title">
        <h4 id="basic-tier-title" class="tier-name">Standard Access</h4>
        <div class="tier-price">
          <span class="price">€0</span>
          <span class="period">/ forever</span>
        </div>
        
        <ul class="features-list">
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Receive UM monthly newsletter</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Participate in Mentorship & Guest Lectures</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Register for UniCircle events</li>
          <li style="opacity: 0.5;"><span class="iconify cross" data-icon="ph:x-circle-fill"></span> Priority profile visibility</li>
        </ul>

        <button class="select-tier-btn basic-btn" aria-label="Register for Basic Network tier">Active Membership</button>
      </section>

      <!-- Tier 2: Contribution -->
      <section class="sbe-card tier-card premium" aria-labelledby="premium-tier-title">
        <span class="popular-tag">Give What You Can</span>
        <h4 id="premium-tier-title" class="tier-name" style="color: var(--um-orange-red);">Supporter Contribution</h4>
        
        <div style="margin: var(--space-3) 0; display: flex; flex-direction: column; gap: var(--space-2);">
          <label for="contribution-amount" style="font-size: var(--text-xs); font-weight: 600;">Choose your monthly support:</label>
          <div style="display: flex; align-items: center; gap: var(--space-2);">
            <button style="border: 1px solid var(--um-orange-red); background: white; color: var(--um-orange-red); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">€5</button>
            <button style="border: 1px solid var(--um-orange-red); background: var(--um-orange-red); color: white; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">€10</button>
            <button style="border: 1px solid var(--um-orange-red); background: white; color: var(--um-orange-red); padding: 4px 8px; border-radius: 4px; cursor: pointer; font-weight: bold;">€25</button>
            <input type="number" id="contribution-amount" placeholder="Other" style="width: 70px; padding: 4px; border: 1px solid var(--color-border); border-radius: 4px;">
          </div>
        </div>

        <ul class="features-list">
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> All Standard features included</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> <strong>Directly fund platform independent hosting</strong></li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> <strong>"Supporter" Profile Badge</strong></li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> Priority application for Carl Square vacancies</li>
        </ul>

        <button class="select-tier-btn premium-btn" aria-label="Upgrade to Alumni Supporter tier">Become a Supporter</button>
      </section>

    </div>
  </div>
</div>
`,

    // ========================================
    // LANDING PAGE — shown to non-logged users
    // ========================================
    landing: `
<div class="uc-landing">

  <!-- ===== HERO ===== -->
  <section class="uc-lp-hero">
    <div class="uc-lp-hero-inner">
      <div>
        <div class="uc-lp-eyebrow">
          <img src="unicircle-logo.png" alt="UniCircle" style="height:18px;display:inline;vertical-align:middle;filter:brightness(10);">
          The independent Maastricht University alumni network
        </div>
        <h1 class="uc-lp-h1">Welcome to your lifelong <span style="color:var(--uc-sky)">UM professional network</span></h1>
        <p class="uc-lp-sub">Connect, mentor and grow with 50,000+ Maastricht University graduates across 80+ countries — City Hubs, mentorship, events, jobs and the PBL Hub, all in one place.</p>
        <div class="uc-lp-join-form">
          <input type="email" id="lp-email" class="uc-lp-email" placeholder="Enter your email address" autocomplete="email">
          <button class="uc-lp-join-btn" id="lp-join-btn">Join now</button>
        </div>
        <p class="uc-lp-signin-hint">Already a member? <a id="lp-signin-link">Sign in</a></p>
        <div class="uc-lp-badges">
          <span class="uc-lp-badge"><span class="iconify" data-icon="ph:shield-check-fill"></span> Alumni-run &amp; independent</span>
          <span class="uc-lp-badge"><span class="iconify" data-icon="ph:heart-fill"></span> Give What You Can</span>
          <span class="uc-lp-badge"><span class="iconify" data-icon="ph:flag-fill"></span> EU-hosted</span>
        </div>
      </div>
      <div class="uc-lp-visual">
        <img src="Image_ressources/banner_stay_connected_to_your_lifelong_global_network.png" alt="UniCircle alumni network" loading="eager">
      </div>
    </div>
  </section>

  <!-- ===== STATS BAR ===== -->
  <section class="uc-lp-stats">
    <div class="uc-lp-stats-row">
      <div class="uc-lp-stat">
        <span class="uc-lp-stat-n">50,000+</span>
        <span class="uc-lp-stat-l">UM alumni worldwide</span>
      </div>
      <div class="uc-lp-sep"></div>
      <div class="uc-lp-stat">
        <span class="uc-lp-stat-n">80+</span>
        <span class="uc-lp-stat-l">countries represented</span>
      </div>
      <div class="uc-lp-sep"></div>
      <div class="uc-lp-stat">
        <span class="uc-lp-stat-n">30+</span>
        <span class="uc-lp-stat-l">active city hubs</span>
      </div>
      <div class="uc-lp-sep"></div>
      <div class="uc-lp-stat">
        <span class="uc-lp-stat-n">2,500+</span>
        <span class="uc-lp-stat-l">alumni mentors</span>
      </div>
    </div>
  </section>

  <!-- ===== FEATURES GRID ===== -->
  <section class="uc-lp-feats">
    <h2 class="uc-lp-title">Everything your UM career needs</h2>
    <p class="uc-lp-sub2">Built by alumni, for alumni — shaped by 40+ graduate interviews</p>
    <div class="uc-lp-grid">

      <div class="uc-lp-feat">
        <div class="uc-lp-feat-ico" style="background:linear-gradient(135deg,var(--uc-cobalt),var(--uc-navy))">
          <span class="iconify" data-icon="ph:map-pin-area-fill"></span>
        </div>
        <h3>City Hubs</h3>
        <p>See which UM alumni are in your city. Join subgroups in Amsterdam, Munich, London, Dubai, New York and 25+ more.</p>
      </div>

      <div class="uc-lp-feat">
        <div class="uc-lp-feat-ico" style="background:linear-gradient(135deg,var(--uc-azure),var(--uc-cobalt))">
          <span class="iconify" data-icon="ph:handshake-fill"></span>
        </div>
        <h3>Alumni Mentorship</h3>
        <p>Toggle your mentor status to support current UM students — or find a senior alumni mentor in your exact field.</p>
      </div>

      <div class="uc-lp-feat">
        <div class="uc-lp-feat-ico" style="background:linear-gradient(135deg,var(--uc-sky),var(--uc-azure))">
          <span class="iconify" data-icon="ph:calendar-check-fill"></span>
        </div>
        <h3>Events — See Who's Coming</h3>
        <p>LinkedIn-style RSVP. Know which classmates from your exact tutorial group are attending <em>before</em> you commit.</p>
      </div>

      <div class="uc-lp-feat">
        <div class="uc-lp-feat-ico" style="background:linear-gradient(135deg,var(--uc-navy),var(--uc-cobalt))">
          <span class="iconify" data-icon="ph:briefcase-metal-fill"></span>
        </div>
        <h3>UM-Only Jobs &amp; Internships</h3>
        <p>Post or discover vacancies explicitly seeking Maastricht graduates. PBL-culture employers, instantly searchable.</p>
      </div>

      <div class="uc-lp-feat">
        <div class="uc-lp-feat-ico" style="background:linear-gradient(135deg,var(--uc-cobalt),var(--uc-azure))">
          <span class="iconify" data-icon="ph:lightbulb-filament-fill"></span>
        </div>
        <h3>PBL Hub</h3>
        <p>Post real academic case challenges and get answers from alumni practitioners — the PBL spirit lives on after graduation.</p>
      </div>

      <div class="uc-lp-feat">
        <div class="uc-lp-feat-ico" style="background:linear-gradient(135deg,var(--uc-sky),var(--uc-cobalt))">
          <span class="iconify" data-icon="ph:chat-circle-dots-fill"></span>
        </div>
        <h3>Direct Messaging</h3>
        <p>Instant 1-on-1 conversation with any UniCircle member. No InMail credits, no premium paywalls. Just alumni talking.</p>
      </div>

    </div>
  </section>

  <!-- ===== WHY UNICIRCLE ===== -->
  <section class="uc-lp-why">
    <div class="uc-lp-why-inner">
      <div class="uc-lp-why-text">
        <span class="uc-lp-tag">Why UniCircle?</span>
        <h2>Not the official UM Alumni platform. Faster, more personal, alumni-run.</h2>
        <ul class="uc-lp-checks">
          <li><span class="iconify" data-icon="ph:check-circle-fill" style="color:var(--uc-sky)"></span><span><strong>UM-wide, not faculty-specific</strong> — all 16 faculties, one network, one shared identity</span></li>
          <li><span class="iconify" data-icon="ph:check-circle-fill" style="color:var(--uc-sky)"></span><span><strong>Alumni-built</strong> — no committees, no 6-month approval cycles; features ship weekly</span></li>
          <li><span class="iconify" data-icon="ph:check-circle-fill" style="color:var(--uc-sky)"></span><span><strong>Give What You Can</strong> — €5–€10/month or €0; your choice, no pressure</span></li>
          <li><span class="iconify" data-icon="ph:check-circle-fill" style="color:var(--uc-sky)"></span><span><strong>Student–alumni bridge</strong> — mentoring and PBL collaboration built in from day one</span></li>
          <li><span class="iconify" data-icon="ph:check-circle-fill" style="color:var(--uc-sky)"></span><span><strong>EU data sovereignty</strong> — hosted on Hetzner, Germany; no US data dependency</span></li>
        </ul>
        <p class="uc-lp-prof">Prof. Dr. Jan M. Smits (UM Law Faculty) is in conversations to co-fund a UM-endorsed version of UniCircle. Faculty backing is building.</p>
      </div>
      <div class="uc-lp-visual">
        <img src="Image_ressources/Mood_images/um-tapijn-202010-005_2.jpg" alt="UM Tapijn campus" loading="lazy">
      </div>
    </div>
  </section>

  <!-- ===== TESTIMONIALS ===== -->
  <section class="uc-lp-quotes">
    <h2 class="uc-lp-title">What alumni say</h2>
    <p class="uc-lp-sub2">From our community interviews — 40+ UM graduates surveyed</p>
    <div class="uc-lp-grid">
      <blockquote class="uc-lp-quote">
        <p>"The City Hub feature is exactly what I needed. I found 40 UM alumni in Amsterdam in minutes — we now have a monthly meetup."</p>
        <footer class="uc-lp-quote-foot">
          <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="">
          <div><strong>Elena V.</strong><span>MSc Finance · Amsterdam Hub</span></div>
        </footer>
      </blockquote>
      <blockquote class="uc-lp-quote">
        <p>"I posted a PBL case on ECB hedging and had three senior risk architects reply within hours. UniCircle bridges the gap LinkedIn can't."</p>
        <footer class="uc-lp-quote-foot">
          <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="">
          <div><strong>Jean Maurice H.</strong><span>MSc Financial Economics · Maastricht</span></div>
        </footer>
      </blockquote>
      <blockquote class="uc-lp-quote">
        <p>"I hire interns who understand PBL culture. UniCircle gives me direct access to UM graduates — no recruitment fees, no middleman."</p>
        <footer class="uc-lp-quote-foot">
          <img src="Image_ressources/Mood_images/eukste_bezienswaardigheden_maastricht_townhouse.jpg" alt="">
          <div><strong>David D.</strong><span>Co-Founder · Munich Alumni Chair</span></div>
        </footer>
      </blockquote>
    </div>
  </section>

  <!-- ===== BOTTOM CTA ===== -->
  <section class="uc-lp-cta">
    <h2>Ready to reconnect with your UM network?</h2>
    <p>Join thousands of Maastricht University alumni already on UniCircle.</p>
    <button class="uc-lp-cta-big" id="lp-bottom-join">Join UniCircle — it's free</button>
    <p class="uc-lp-fine">No credit card required · Give What You Can · EU-hosted · Independent</p>
  </section>

  <!-- ===== FOOTER ===== -->
  <footer class="uc-lp-foot">
    <div class="uc-lp-foot-row">
      <div class="uc-lp-foot-brand">
        <img src="unicircle-logo.png" alt="UniCircle" style="height:20px;">
        UniCircle — unicircle.eu
      </div>
      <div class="uc-lp-foot-links">
        <a id="lp-foot-signin">Sign in</a>
        <a id="lp-foot-join">Join now</a>
        <span>© 2026 UniCircle · Independent UM Alumni Community</span>
      </div>
    </div>
  </footer>

</div>
`
  };

  const appViewport = document.getElementById('app-viewport');
  const navItems = document.querySelectorAll('.nav-menu .nav-item[data-page]');

  // True once auth-ready and user is logged in — gates nav clicks
  let _navReady = false;

  // Initialize router
  function initRouter() {
    // Hash-change: only route when a user is authenticated
    window.addEventListener('hashchange', () => {
      if (!_navReady) return;
      const newPage = window.location.hash.replace('#', '');
      if (fallbacks[newPage]) loadPage(newPage);
    });

    // Navigation click handlers
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if (!_navReady) {
          // Guest clicks nav → open sign-up modal
          window.UC?.openAuth('signup');
          return;
        }
        const targetPage = item.getAttribute('data-page');
        window.location.hash = `#${targetPage}`;
      });

      // Accessibility key support (Enter / Space)
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          item.click();
        }
      });
    });

    // unicircle.js dispatches 'uc:auth-ready' once bootSession() resolves
    document.addEventListener('uc:auth-ready', (e) => {
      if (e.detail && e.detail.user) {
        _navReady = true;
        let page = window.location.hash.replace('#', '');
        if (!fallbacks[page] || page === 'landing') page = 'feed';
        window.location.hash = '#' + page;
        loadPage(page);
      } else {
        _navReady = false;
        loadPage('landing');
      }
    }, { once: true });

    // unicircle.js dispatches 'uc:login' after a successful sign-in
    document.addEventListener('uc:login', () => {
      _navReady = true;
      window.location.hash = '#feed';
      loadPage('feed');
    });
  }

  // Load page content from inline fallback templates (single source of truth)
  function loadPage(pageName) {
    // Update active nav class
    navItems.forEach(item => {
      if (item.getAttribute('data-page') === pageName) {
        item.classList.add('active');
        item.setAttribute('aria-current', 'page');
      } else {
        item.classList.remove('active');
        item.removeAttribute('aria-current');
      }
    });

    const render = () => {
      appViewport.innerHTML = fallbacks[pageName] || '';
      initializePageInteractivity(pageName);
    };

    if (document.startViewTransition) {
      document.startViewTransition(render);
    } else {
      render();
    }
  }

  // Initialize specific interactive scripts per component page
  function initializePageInteractivity(pageName) {
    if (pageName === 'landing') {
      initLandingInteractivity();
    } else if (pageName === 'feed') {
      initFeedInteractivity();
    } else if (pageName === 'network') {
      initNetworkInteractivity();
    } else if (pageName === 'pbl-hub') {
      initPblInteractivity();
    } else if (pageName === 'events') {
      initEventsInteractivity();
    } else if (pageName === 'jobs') {
      initJobsInteractivity();
    }
  }

  /* ==========================================
     0. LANDING PAGE INTERACTIVITY
     ========================================== */
  function initLandingInteractivity() {
    const openSignup = () => window.UC?.openAuth('signup');
    const openSignin = () => window.UC?.openAuth('signin');

    const joinBtn = document.getElementById('lp-join-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        const email = document.getElementById('lp-email')?.value?.trim();
        if (email && window.UC) {
          window.UC.openAuth('signup', email);
        } else {
          openSignup();
        }
      });
    }

    document.getElementById('lp-bottom-join')?.addEventListener('click', openSignup);
    document.getElementById('lp-signin-link')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });
    document.getElementById('lp-foot-signin')?.addEventListener('click', (e) => { e.preventDefault(); openSignin(); });
    document.getElementById('lp-foot-join')?.addEventListener('click', (e) => { e.preventDefault(); openSignup(); });

    // Allow pressing Enter in the email field
    document.getElementById('lp-email')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') joinBtn?.click();
    });
  }

  /* ==========================================
     1. FEED COMPONENT INTERACTIVITY
     ========================================== */
  function initFeedInteractivity() {
    // Like button toggle
    const actionBtns = document.querySelectorAll('.feed-post .action-btn:first-child');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const countSpan = btn.closest('.feed-post').querySelector('.likes-count span');
        let currentLikes = parseInt(countSpan.textContent.match(/\d+/)[0] || 0);
        if (btn.classList.contains('active')) {
          btn.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-fill"></span> Liked`;
          countSpan.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-fill"></span> You and ${currentLikes} others`;
        } else {
          btn.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-bold"></span> Like`;
          countSpan.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-fill"></span> ${currentLikes} UM alumni`;
        }
      });
    });

    // Media buttons open post modal pre-tagged
    document.querySelectorAll('.media-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById('post-modal');
        if (modal) {
          const ta = modal.querySelector('textarea');
          if (btn.classList.contains('photo')) ta.placeholder = 'Share a photo from a UM event or your career journey...';
          else if (btn.classList.contains('video')) ta.placeholder = 'Share a video — a lecture, tutorial memory, or career highlight...';
          else if (btn.classList.contains('article')) ta.placeholder = 'Write an article for the UM network — a case study, career insight, or reflection...';
          modal.showModal();
        }
      });
    });

    // Follow buttons toggle
    document.querySelectorAll('.follow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('following')) {
          btn.classList.remove('following');
          btn.textContent = '+ Follow';
          btn.style.cssText = '';
        } else {
          btn.classList.add('following');
          btn.textContent = '✓ Following';
          btn.style.background = 'var(--uc-azure)';
          btn.style.color = '#fff';
          btn.style.border = 'none';
          btn.style.borderRadius = 'var(--radius-full)';
        }
      });
    });

    // Post hiding alert trigger
    const dismissBtns = document.querySelectorAll('.feed-post .options-btn');
    dismissBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const postCard = btn.closest('.feed-post');
        postCard.style.opacity = '0.3';
        postCard.style.pointerEvents = 'none';
        postCard.style.transition = 'opacity 0.3s ease';
        
        // Prepend an undo banner
        const undoBanner = document.createElement('div');
        undoBanner.className = 'sbe-card';
        undoBanner.style.padding = 'var(--space-3) var(--space-4)';
        undoBanner.style.marginBottom = 'var(--space-4)';
        undoBanner.style.display = 'flex';
        undoBanner.style.justifyContent = 'space-between';
        undoBanner.style.alignItems = 'center';
        undoBanner.style.backgroundColor = 'var(--color-surface-hover)';
        undoBanner.style.borderLeft = '3px solid var(--um-orange-red)';
        undoBanner.innerHTML = `
          <span style="font-size: var(--text-xs); color: var(--color-text-secondary);">Post hidden in feed.</span>
          <button style="background: none; border: none; color: var(--um-light-blue); font-weight: 700; cursor: pointer; font-size: var(--text-xs);">Undo</button>
        `;
        postCard.parentNode.insertBefore(undoBanner, postCard);

        undoBanner.querySelector('button').addEventListener('click', () => {
          postCard.style.opacity = '1';
          postCard.style.pointerEvents = 'all';
          undoBanner.remove();
        });
      });
    });

    // Start a post dynamic dialog modal
    const startPostTrigger = document.querySelector('.create-post-box .trigger-btn');
    const modal = document.getElementById('post-modal');
    if (startPostTrigger && modal) {
      startPostTrigger.addEventListener('click', () => modal.showModal());
      
      const closeBtn = modal.querySelector('.close-btn');
      const cancelBtn = modal.querySelector('.cancel-btn');
      
      closeBtn.addEventListener('click', () => modal.close());
      cancelBtn.addEventListener('click', () => modal.close());

      // Handle post submission simulator
      const form = modal.querySelector('form');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const postText = modal.querySelector('textarea').value;
        const selectedDegree = modal.querySelector('#post-degree').value;
        if (!postText.trim()) return;

        // Insert new post card at top of feed list
        const postContainer = document.querySelector('.feed-posts-list');
        const newPost = document.createElement('article');
        newPost.className = 'sbe-card feed-post';
        newPost.innerHTML = `
          <div class="post-header">
            <div class="author-info">
              <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Jean Maurice profile picture" class="avatar">
              <div class="details">
                <span class="name">Jean Maurice H. <span class="degree-badge ${selectedDegree.toLowerCase()}">${selectedDegree}</span></span>
                <span class="headline">M.Sc. Financial Economics | BSc International Marketing</span>
                <span class="time">Just now</span>
              </div>
            </div>
            <button class="options-btn" aria-label="Post Options">⋮</button>
          </div>
          <div class="post-content">
            <p>${postText.replace(/\n/g, '<br>')}</p>
          </div>
          <div class="post-stats">
            <span class="likes-count"><span class="iconify" data-icon="ph:thumbs-up-fill"></span> Be the first to like this</span>
            <span>0 comments</span>
          </div>
          <div class="post-actions">
            <button class="action-btn"><span class="iconify" data-icon="ph:thumbs-up-bold"></span> Like</button>
            <button class="action-btn"><span class="iconify" data-icon="ph:chat-text-bold"></span> Comment</button>
            <button class="action-btn"><span class="iconify" data-icon="ph:share-network-bold"></span> Share</button>
          </div>
        `;

        postContainer.prepend(newPost);
        modal.querySelector('textarea').value = '';
        modal.close();
        
        // Re-init feed interactivity to bind handlers to newly added post
        initFeedInteractivity();
      });
    }
  }

  /* ==========================================
     2. AI NETWORK INTERACTIVITY
     ========================================== */
  function initNetworkInteractivity() {
    const searchInput = document.querySelector('.ai-search-container .search-input');
    const searchSubmit = document.querySelector('.ai-search-container .search-submit');
    const suggestionTags = document.querySelectorAll('.ai-search-container .tag');
    
    const sectorFilter = document.getElementById('filter-sector');
    const courseFilter = document.getElementById('filter-course');
    const periodFilter = document.getElementById('filter-period');
    const tutorialFilter = document.getElementById('filter-tutorial');
    const yearFilter = document.getElementById('filter-year');
    const alumniCards = document.querySelectorAll('.alumni-grid .alumni-card');

    // Conversational search engine simulator
    function performAISearch(queryText) {
      const normalizedQuery = queryText.toLowerCase();
      
      // Auto-set selects based on keywords in search box
      if (normalizedQuery.includes('finance') || normalizedQuery.includes('investment')) {
        sectorFilter.value = 'Finance';
      } else if (normalizedQuery.includes('consulting') || normalizedQuery.includes('strategy')) {
        sectorFilter.value = 'Consulting';
      } else if (normalizedQuery.includes('technology') || normalizedQuery.includes('ai') || normalizedQuery.includes('startup')) {
        sectorFilter.value = 'Tech';
      }

      if (normalizedQuery.includes('international financial') || normalizedQuery.includes('ifm')) {
        courseFilter.value = 'International Financial Management';
      } else if (normalizedQuery.includes('problem based') || normalizedQuery.includes('pbl')) {
        courseFilter.value = 'Problem Based Learning in Finance';
      }

      if (normalizedQuery.includes('period 5')) {
        periodFilter.value = '5';
      } else if (normalizedQuery.includes('period 1')) {
        periodFilter.value = '1';
      }

      const yearMatch = normalizedQuery.match(/\b(202[0-9]|class of (\d{4}))\b/);
      if (yearMatch) yearFilter.value = yearMatch[2] || yearMatch[1];

      if (normalizedQuery.includes('tutorial 01') || normalizedQuery.includes('t01')) {
        tutorialFilter.value = '01';
      } else if (normalizedQuery.includes('tutorial 04') || normalizedQuery.includes('t04')) {
        tutorialFilter.value = '04';
      }

      applyFilters();
    }

    // Apply the granular standard filters
    function applyFilters() {
      const selectedSector = sectorFilter.value;
      const selectedCourse = courseFilter.value;
      const selectedPeriod = periodFilter.value;
      const selectedTutorial = tutorialFilter.value;
      const selectedYear = yearFilter ? yearFilter.value : '';
      let visibleCount = 0;

      alumniCards.forEach(card => {
        let match = true;
        if (selectedSector && card.getAttribute('data-sector') !== selectedSector) match = false;
        if (selectedCourse && card.getAttribute('data-course') !== selectedCourse) match = false;
        if (selectedPeriod && card.getAttribute('data-period') !== selectedPeriod) match = false;
        if (selectedTutorial && card.getAttribute('data-tutorial') !== selectedTutorial) match = false;
        if (selectedYear && card.getAttribute('data-year') !== selectedYear) match = false;

        if (match) {
          visibleCount++;
          card.style.display = 'flex';
          card.style.opacity = '0';
          card.style.transform = 'translateY(10px)';
          setTimeout(() => {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 50);
        } else {
          card.style.display = 'none';
        }
      });

      // Empty state
      let emptyEl = document.getElementById('alumni-empty-state');
      if (visibleCount === 0) {
        if (!emptyEl) {
          emptyEl = document.createElement('div');
          emptyEl.id = 'alumni-empty-state';
          emptyEl.style.cssText = 'grid-column:1/-1;text-align:center;padding:var(--space-8);color:var(--color-text-secondary);';
          emptyEl.innerHTML = `<span class="iconify" data-icon="ph:users-three-duotone" style="font-size:48px;opacity:.4;"></span><p style="margin-top:var(--space-3);font-family:var(--font-heading);font-weight:600;">No alumni match your filters.</p><p style="font-size:var(--text-xs);margin-top:var(--space-2);">Try broadening your search or <a href="#" onclick="document.querySelectorAll('.grid-filter-controls select').forEach(s=>s.value='');applyFilters&&applyFilters();return false;" style="color:var(--uc-azure);">clear all filters</a>.</p>`;
          document.querySelector('.alumni-grid').appendChild(emptyEl);
        }
        emptyEl.style.display = 'block';
      } else if (emptyEl) {
        emptyEl.style.display = 'none';
      }
    }

    // Event listeners for selects
    [sectorFilter, courseFilter, periodFilter, tutorialFilter, yearFilter].filter(Boolean).forEach(elem => {
      elem.addEventListener('change', applyFilters);
    });

    // Event listener for search action
    if (searchSubmit && searchInput) {
      searchSubmit.addEventListener('click', () => {
        performAISearch(searchInput.value);
      });
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          performAISearch(searchInput.value);
        }
      });
    }

    // Suggestion tags trigger search
    suggestionTags.forEach(tag => {
      tag.addEventListener('click', () => {
        const query = tag.textContent.trim().replace(/^"|"$/g, '');
        searchInput.value = query;
        performAISearch(query);
      });
    });

    // Invite to Solve Case Dialog
    const inviteModal = document.getElementById('invite-modal');
    if (inviteModal) {
      const pblBtns = document.querySelectorAll('.alumni-card .pbl-btn');
      pblBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const alumniName = btn.closest('.alumni-card').querySelector('.name').firstChild.textContent.trim();
          inviteModal.querySelector('.invitee-name').textContent = alumniName;
          inviteModal.showModal();
        });
      });

      inviteModal.querySelector('.close-btn').addEventListener('click', () => inviteModal.close());
      inviteModal.querySelector('.cancel-btn').addEventListener('click', () => inviteModal.close());

      inviteModal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const successMessage = document.createElement('div');
        successMessage.style.position = 'fixed';
        successMessage.style.bottom = '20px';
        successMessage.style.right = '20px';
        successMessage.style.backgroundColor = '#5fcf80';
        successMessage.style.color = 'white';
        successMessage.style.padding = '12px 24px';
        successMessage.style.borderRadius = 'var(--radius-md)';
        successMessage.style.boxShadow = 'var(--shadow-lg)';
        successMessage.style.zIndex = '99999';
        successMessage.style.fontFamily = 'var(--font-heading)';
        successMessage.style.fontWeight = '700';
        successMessage.innerHTML = `<span class="iconify" data-icon="ph:check-circle-fill"></span> Invite sent to alumni!`;
        document.body.appendChild(successMessage);
        
        setTimeout(() => successMessage.remove(), 3000);
        inviteModal.close();
      });
    }

    // Connect button trigger simulator
    const connectBtns = document.querySelectorAll('.alumni-card .connect-btn');
    connectBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.alumni-card')?.querySelector('.name')?.firstChild?.textContent?.trim() || 'this alumnus';
        if (btn.classList.contains('connected')) {
          btn.classList.remove('connected');
          btn.textContent = 'Connect';
          btn.style.backgroundColor = '';
        } else {
          btn.classList.add('connected');
          btn.textContent = 'Pending';
          btn.style.backgroundColor = 'var(--color-text-muted)';
          if (window.UC) window.UC.openChat && showToast(`Connection request sent to ${name}! You can message them directly.`);
        }
      });
    });

    // City hub join buttons
    document.querySelectorAll('#city-hubs .connect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const city = btn.closest('.sbe-card')?.querySelector('h4')?.textContent?.replace(/^[^\w]+/, '') || 'this hub';
        if (btn.classList.contains('joined')) {
          btn.classList.remove('joined');
          btn.textContent = btn.textContent.replace('✓ Joined', 'Join ' + city.split(',')[0] + ' Hub');
          btn.style.backgroundColor = '';
        } else {
          btn.classList.add('joined');
          btn.textContent = '✓ Joined';
          btn.style.backgroundColor = 'var(--uc-azure)';
          btn.style.color = '#fff';
          btn.style.border = 'none';
          if (window.UC) showToast(`You joined the ${city.split(',')[0]} Hub! Members can now see you here.`);
        }
      });
    });

    // Mentorship "Find a Mentor" button
    const findMentorBtn = document.querySelector('#mentorship button[style*="background: white"]') ||
      document.querySelector('#mentorship .sbe-card:first-child button');
    if (findMentorBtn) {
      findMentorBtn.addEventListener('click', () => {
        document.querySelector('#mentorship .alumni-grid')?.scrollIntoView({ behavior: 'smooth' });
        showToast('Browse available mentors below — click "Request Mentorship" to connect.');
      });
    }

    // Mentorship "Become a Mentor" button
    document.querySelectorAll('#mentorship .connect-btn').forEach(btn => {
      if (btn.textContent.includes('Become a Mentor')) {
        btn.addEventListener('click', () => {
          if (window.UC && window.UC.state.user) {
            window.UC.openProfile();
            showToast('Toggle "Offer mentorship" in your profile to appear in the mentor list.');
          } else if (window.UC) {
            window.UC.openAuth('signup');
          }
        });
      }
    });

    // "Request Mentorship" button on mentor cards
    document.querySelectorAll('#mentorship .card-footer .connect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.closest('.alumni-card')?.querySelector('.name')?.textContent?.trim() || 'this mentor';
        if (window.UC && window.UC.state.user) {
          window.UC.openChat();
          showToast(`Opening chat — message ${name} directly to request mentorship.`);
        } else if (window.UC) {
          window.UC.openAuth('signup');
        }
      });
    });

    // Guest lecture "Volunteer to Speak" button
    document.querySelectorAll('#guest-lectures .connect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = btn.closest('article')?.querySelector('p')?.textContent?.match(/Course: (.+?) •/)?.[1] || 'this course';
        if (window.UC && window.UC.state.user) {
          showToast(`Interest registered for "${course}"! The course coordinator will contact you via your profile email.`);
          btn.textContent = '✓ Interest Registered';
          btn.style.backgroundColor = 'var(--uc-cobalt)';
          btn.style.color = '#fff';
          btn.style.border = 'none';
        } else if (window.UC) {
          window.UC.openAuth('signup');
        }
      });
    });
  }

  function showToast(msg) {
    if (window.UC && window.UC.state !== undefined) {
      // Use UniCircle toast
      const t = document.createElement('div');
      t.className = 'uc-toast uc-toast--ok in';
      t.innerHTML = msg;
      document.body.appendChild(t);
      setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 3500);
    }
  }

  /* ==========================================
     3. PBL PROBLEM SOLVING HUB INTERACTIVITY
     ========================================== */
  function initPblInteractivity() {
    // Upvoting logic
    const upvoteBtns = document.querySelectorAll('.pbl-case-card .upvote-widget');
    upvoteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('voted');
        const countSpan = btn.querySelector('.count');
        let currentCount = parseInt(countSpan.textContent);
        if (btn.classList.contains('voted')) {
          btn.innerHTML = `<span class="iconify" data-icon="ph:caret-up-fill"></span> <span class="count">${currentCount + 1}</span>`;
        } else {
          btn.innerHTML = `<span class="iconify" data-icon="ph:caret-up-bold"></span> <span class="count">${currentCount - 1}</span>`;
        }
        // Recursively re-bind click
        initPblInteractivity();
      });
    });

    // Create PBL Case Modal
    const createBtn = document.querySelector('.pbl-hub-header .pbl-create-btn');
    const modal = document.getElementById('pbl-create-modal');
    if (createBtn && modal) {
      createBtn.addEventListener('click', () => modal.showModal());
      modal.querySelector('.close-btn').addEventListener('click', () => modal.close());
      modal.querySelector('.cancel-btn').addEventListener('click', () => modal.close());

      modal.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = modal.querySelector('#case-title-input').value;
        const course = modal.querySelector('#case-course-input').value;
        const description = modal.querySelector('#case-desc-input').value;

        if (!title.trim() || !description.trim()) return;

        const boardList = document.querySelector('.pbl-cases-list');
        const newCaseCard = document.createElement('article');
        newCaseCard.className = 'sbe-card pbl-case-card';
        newCaseCard.innerHTML = `
          <div class="case-header">
            <span class="course-tag">${course}</span>
            <span class="difficulty-rating"><span class="iconify" data-icon="ph:star-fill"></span> Intermediate</span>
          </div>
          <h3 class="case-title">${title}</h3>
          <div class="case-author">
            <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Author picture">
            <span>Posted by <span class="author-name">Jean Maurice H.</span> (Student)</span>
          </div>
          <p class="case-description">${description}</p>
          <div class="case-stats">
            <span class="active-solutions"><span class="iconify" data-icon="ph:chat-text-bold"></span> 0 solutions proposed</span>
            <span><span class="iconify" data-icon="ph:eye-bold"></span> 1 view</span>
          </div>
        `;

        boardList.prepend(newCaseCard);
        modal.reset();
        modal.close();
      });
    }
  }

  /* ==========================================
     4. EVENTS COMPONENT INTERACTIVITY
     ========================================== */
  function initEventsInteractivity() {
    // RSVP button toggling
    const attendBtns = document.querySelectorAll('.event-card .attend-btn');
    attendBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('attending');
        if (btn.classList.contains('attending')) {
          btn.innerHTML = `<span class="iconify" data-icon="ph:check-bold"></span> Going`;
          btn.style.backgroundColor = '#5fcf80';
        } else {
          btn.innerHTML = `RSVP`;
          btn.style.backgroundColor = 'var(--um-orange-red)';
        }
      });
    });

    // Event Details buttons
    document.querySelectorAll('.event-card .details-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.event-card');
        const title = card.querySelector('.event-title')?.textContent || 'Event';
        const location = card.querySelector('.event-location')?.textContent?.trim() || '';
        const desc = card.querySelector('.event-description')?.textContent?.trim() || '';
        const day = card.querySelector('.event-date-side .day')?.textContent || '';
        const month = card.querySelector('.event-date-side .month')?.textContent || '';
        const year = card.querySelector('.event-date-side .year')?.textContent || '';
        const dlg = document.createElement('dialog');
        dlg.className = 'sbe-modal';
        dlg.innerHTML = `
          <div class="modal-wrapper">
            <div class="modal-header">
              <h3>${title}</h3>
              <button class="close-btn" aria-label="Close">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
              <p style="font-size:var(--text-sm);font-weight:700;color:var(--uc-azure);">${location}</p>
              <p style="font-size:var(--text-sm);font-weight:600;">${day} ${month} ${year}</p>
              <p style="font-size:var(--text-sm);line-height:1.6;">${desc}</p>
              <p style="font-size:var(--text-xs);color:var(--color-text-secondary);">RSVP via UniCircle to appear on the attendee list and let classmates know you're coming.</p>
            </div>
            <div class="modal-footer">
              <button class="cancel-btn">Close</button>
              <button class="submit-btn" style="background:var(--uc-azure);border:none;color:#fff;">RSVP Now</button>
            </div>
          </div>`;
        document.body.appendChild(dlg);
        dlg.showModal();
        dlg.querySelector('.close-btn').onclick = () => dlg.close();
        dlg.querySelector('.cancel-btn').onclick = () => dlg.close();
        dlg.querySelector('.submit-btn').onclick = () => {
          dlg.close();
          const rsvpBtn = card.querySelector('.attend-btn');
          if (rsvpBtn && !rsvpBtn.classList.contains('attending')) rsvpBtn.click();
        };
        dlg.addEventListener('close', () => dlg.remove());
      });
    });

    // Overlap pill classmates modal lookup
    const overlapPills = document.querySelectorAll('.event-card .tutorial-overlap-pill');
    const overlapModal = document.getElementById('overlap-modal');
    if (overlapPills && overlapModal) {
      overlapPills.forEach(pill => {
        pill.addEventListener('click', () => {
          const eventTitle = pill.closest('.event-details-side').querySelector('.event-title').textContent;
          overlapModal.querySelector('.modal-header h3').textContent = `Classmates overlap - ${eventTitle}`;
          overlapModal.showModal();
        });
      });

      overlapModal.querySelector('.close-btn').addEventListener('click', () => overlapModal.close());
      overlapModal.querySelector('.close-btn-footer').addEventListener('click', () => overlapModal.close());
    }
  }

  /* ==========================================
     5. JOBS & PREMIUM INTERACTIVITY
     ========================================== */
  function initJobsInteractivity() {
    // Job application buttons
    document.querySelectorAll('.jobs-list .apply-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.job-card');
        const title = card?.querySelector('.title')?.textContent || 'this position';
        const company = card?.querySelector('.company')?.textContent || '';
        const dlg = document.createElement('dialog');
        dlg.className = 'sbe-modal';
        dlg.innerHTML = `
          <div class="modal-wrapper">
            <div class="modal-header">
              <h3>Apply: ${title}</h3>
              <button class="close-btn" aria-label="Close">✕</button>
            </div>
            <div class="modal-body" style="display:flex;flex-direction:column;gap:var(--space-3);">
              <p style="font-size:var(--text-sm);color:var(--color-text-secondary);">${company}</p>
              ${window.UC && window.UC.state.user
                ? `<p style="font-size:var(--text-sm);">Your UniCircle profile will be sent to the recruiter. Add a note below (optional).</p>
                   <textarea placeholder="Cover note — why are you a great fit for this role?" style="border:1px solid var(--color-border);border-radius:var(--radius-sm);padding:10px;font-size:var(--text-sm);min-height:80px;font-family:var(--font-body);"></textarea>`
                : `<p style="font-size:var(--text-sm);">Please <a href="#" onclick="document.querySelector('dialog.sbe-modal').close();window.UC&&window.UC.openAuth('signup');return false;" style="color:var(--uc-azure);">create a UniCircle account</a> to apply — your profile is your CV.</p>`}
            </div>
            <div class="modal-footer">
              <button class="cancel-btn">Cancel</button>
              ${window.UC && window.UC.state.user
                ? `<button class="submit-btn" style="background:var(--uc-azure);border:none;color:#fff;">Submit Application</button>`
                : ''}
            </div>
          </div>`;
        document.body.appendChild(dlg);
        dlg.showModal();
        dlg.querySelector('.close-btn').onclick = () => dlg.close();
        dlg.querySelector('.cancel-btn').onclick = () => dlg.close();
        dlg.querySelector('.submit-btn')?.addEventListener('click', () => {
          dlg.close();
          showToast(`Application sent for "${title}"! The recruiter will reach you via your profile email.`);
          btn.textContent = '✓ Applied';
          btn.style.backgroundColor = 'var(--uc-cobalt)';
          btn.style.color = '#fff';
          btn.disabled = true;
        });
        dlg.addEventListener('close', () => dlg.remove());
      });
    });

    // Contribution amount button selection
    document.querySelectorAll('.premium-tiers-container .tier-card.premium button[style*="border"]').forEach(amountBtn => {
      amountBtn.addEventListener('click', () => {
        document.querySelectorAll('.premium-tiers-container .tier-card.premium button[style*="border"]').forEach(b => {
          b.style.background = 'white';
          b.style.color = 'var(--um-orange-red)';
        });
        amountBtn.style.background = 'var(--um-orange-red)';
        amountBtn.style.color = 'white';
      });
    });

    // Select Tier confirm simulator
    const selectTierBtns = document.querySelectorAll('.premium-tiers-container .select-tier-btn');
    selectTierBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tierName = btn.closest('.tier-card').querySelector('.tier-name').textContent;
        const confirmDialog = document.createElement('dialog');
        confirmDialog.className = 'sbe-modal';
        confirmDialog.style.display = 'block'; // Make dynamic visible wrapper
        confirmDialog.innerHTML = `
          <div class="modal-wrapper">
            <div class="modal-header">
              <h3>Membership Registration</h3>
            </div>
            <div class="modal-body" style="padding: var(--space-5); text-align: center;">
              <p>You have selected the <strong>${tierName} Membership</strong>. Would you like to confirm registration and sync this selection with your active Maastricht Student Portfolio?</p>
            </div>
            <div class="modal-footer">
              <button class="cancel-btn">Back</button>
              <button class="submit-btn" style="background-color: var(--um-orange-red); border: none; color: white;">Confirm & Sync</button>
            </div>
          </div>
        `;
        
        document.body.appendChild(confirmDialog);
        
        confirmDialog.querySelector('.cancel-btn').addEventListener('click', () => {
          confirmDialog.remove();
        });

        confirmDialog.querySelector('.submit-btn').addEventListener('click', () => {
          const welcomeMessage = document.createElement('div');
          welcomeMessage.style.position = 'fixed';
          welcomeMessage.style.bottom = '20px';
          welcomeMessage.style.right = '20px';
          welcomeMessage.style.backgroundColor = 'var(--um-dark-blue)';
          welcomeMessage.style.color = 'white';
          welcomeMessage.style.padding = '12px 24px';
          welcomeMessage.style.borderRadius = 'var(--radius-md)';
          welcomeMessage.style.boxShadow = 'var(--shadow-lg)';
          welcomeMessage.style.zIndex = '99999';
          welcomeMessage.style.fontFamily = 'var(--font-heading)';
          welcomeMessage.style.fontWeight = '700';
          welcomeMessage.innerHTML = `<span class="iconify" data-icon="ph:sparkle-fill" style="color: gold;"></span> Successfully synchronized! Enjoy ${tierName}.`;
          document.body.appendChild(welcomeMessage);
          
          setTimeout(() => welcomeMessage.remove(), 4000);
          confirmDialog.remove();
        });
      });
    });
  }

  // Load router
  initRouter();
});
