/* ==========================================
   Maastricht University SBE Alumni Network
   SPA Router & Dynamic Fallback Controller (May 2026)
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
        <p class="title">M.Sc. Financial Economics | B.Sc. International Business<br><strong>Maastricht University SBE</strong></p>
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
        <p style="font-size: 9px; color: oklch(1 0 0 / 0.8); margin-top: 2px;">School of Business and Economics</p>
      </div>
    </div>
  </aside>

  <!-- CENTER COLUMN: ACTIVE DASHBOARD FEED -->
  <main class="feed-content" role="main" aria-label="Dashboard Feed">
    
    <!-- Post Creation Box -->
    <div class="sbe-card create-post-box">
      <div class="input-row">
        <img src="Image_ressources/Mood_images/nikhil1256_A_man_walking_dressed_in_professional_business_attir_8fa44d19-f313-4ba2-aba1-72254228f5eb.png" alt="Your avatar" class="avatar">
        <button class="trigger-btn">Start a post about SBE cases, classes...</button>
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
              <span class="headline">Alumni Relations Director at School of Business and Economics</span>
              <span class="time">5 hours ago • <span class="iconify" data-icon="ph:globe-hemisphere-east-bold"></span></span>
            </div>
          </div>
          <button class="options-btn" aria-label="Post Options">⋮</button>
        </div>

        <div class="post-content">
          <p>We are excited to launch the brand-new digital portal for the SBE Alumni Network! 🚀</p>
          <p>With more than 50,000 alumni worldwide, our goal is to build an active, engaged professional community. Whether you want to recruit SBE talent, collaborate on academic Problem-Based Learning cases, or track tutorial classmate reunions at our upcoming events, stay connected! Check out the Premium subscription to search our complete, granular tutorial database.</p>
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
      <h3 id="post-modal-title">Create SBE Feed Post</h3>
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
          <option value="">All SBE Courses</option>
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

    </div>
  </div>

  <!-- Alumni Search Results Title -->
  <div style="margin-bottom: var(--space-4);">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800;">Alumni Search Results <span style="font-weight: 500; font-size: var(--text-xs); color: var(--color-text-muted);">(Showing database matches)</span></h3>
  </div>

  <!-- Dynamic Alumni Profile Grid -->
  <div class="alumni-grid">
    
    <!-- CARD 1: OVERLAP MATCH (Binance) -->
    <article class="sbe-card alumni-card premium-border" data-sector="Tech" data-course="International Financial Management" data-period="5" data-tutorial="01">
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
    <article class="sbe-card alumni-card" data-sector="Consulting" data-course="International Financial Management" data-period="5" data-tutorial="01">
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
    <article class="sbe-card alumni-card" data-sector="Finance" data-course="Quantitative Modeling" data-period="1" data-tutorial="04">
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
    <article class="sbe-card alumni-card" data-sector="Tech" data-course="Problem Based Learning in Finance" data-period="2" data-tutorial="02">
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
    <article class="sbe-card alumni-card" data-sector="Consulting" data-course="Marketing Strategy" data-period="4" data-tutorial="03">
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
              <span class="mentor-badge">SBE Gold Mentor</span>
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
              <span class="mentor-badge">SBE Alumnus</span>
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
              <span class="mentor-badge">SBE Alumnus</span>
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
    <h2 style="font-family: var(--font-heading); color: white; font-size: var(--text-2xl); font-weight: 800;">SBE Networking Events</h2>
    <p style="font-size: var(--text-sm); color: oklch(1 0 0 / 0.85); margin-top: var(--space-2); line-height: 1.4; max-width: 800px;">
      Never attend an event alone. Our <strong>Tutorial Classmate Overlap</strong> tracker highlights which former classmates from your specific academic courses, periods, and tutorial sections are going, ensuring you always reunite with familiar faces.
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
        <h3 class="event-title">Munich SBE Alumni Regional Meetup</h3>
        <p class="event-description">
          Hosted by David Döbele at the Hofbräuhaus München. With over 3,000 Maastricht alumni based around Munich, join us to catch up on old times, expand your professional SBE network, and discuss regional career opportunities.
        </p>

        <!-- Classmate Overlap tracker pill -->
        <div class="tutorial-overlap-pill" title="Click to view classmate details" aria-label="3 classmates attending. Click to view.">
          <div class="avatars-stack">
            <img src="Image_ressources/Mood_images/conik_photograph_slightly_high-angle_top-down_view_early_mornin_e5cdc1d7-d669-4f45-8b59-5533de6fd313.png" alt="Classmate 1 avatar">
            <img src="Image_ressources/Mood_images/images-maastricht.jpg" alt="Classmate 2 avatar">
            <img src="Image_ressources/Mood_images/eukste_bezienswaardigheden_maastricht_townhouse.jpg" alt="Classmate 3 avatar">
          </div>
          <div class="overlap-text">
            <span>3 classmates</span> from your Period 5 Tutorial 01 are attending!
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
        <h3 class="event-title">SBE London Finance Network Night</h3>
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
        <h3 class="event-title">SBE Maastricht Homecoming Reunion Gala 2026</h3>
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
        The following SBE Alumni from your exact <strong>Period 5 Tutorial 01 (International Financial Management)</strong> are registered to attend this event:
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
      <h4>Official Career Partner: Carl Square</h4>
      <p>
        Carl Square is a leading global technology investment bank. Through our exclusive academic partnership, SBE Alumni get priority career access, exclusive internships, and senior placement vacancies.
      </p>
    </div>
  </div>

  <!-- Job Openings Header -->
  <div style="margin-bottom: var(--space-4);">
    <h3 style="font-family: var(--font-heading); font-size: var(--text-md); font-weight: 800;">Featured SBE Opportunities</h3>
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
          <span><span class="iconify" data-icon="ph:graduation-cap-bold"></span> B.Sc. or M.Sc. SBE Students</span>
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
      <h3>Access the SBE Portal Database</h3>
      <p>
        Support our network database infrastructure and unlock premium professional connections.
      </p>
    </div>

    <div class="tiers-grid">
      
      <!-- Tier 1 -->
      <section class="sbe-card tier-card" aria-labelledby="basic-tier-title">
        <h4 id="basic-tier-title" class="tier-name">Basic Network</h4>
        <div class="tier-price">
          <span class="price">€0</span>
          <span class="period">/ forever</span>
        </div>
        
        <ul class="features-list">
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Receive SBE monthly newsletter</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Update your personal profile</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Register for basic alumni events</li>
          <li style="opacity: 0.5;"><span class="iconify cross" data-icon="ph:x-circle-fill"></span> Complete alumni database search</li>
          <li style="opacity: 0.5;"><span class="iconify cross" data-icon="ph:x-circle-fill"></span> Granular Course/Tutorial matching</li>
          <li style="opacity: 0.5;"><span class="iconify cross" data-icon="ph:x-circle-fill"></span> Direct classmate messaging</li>
        </ul>

        <button class="select-tier-btn basic-btn" aria-label="Register for Basic Network tier">Active Membership</button>
      </section>

      <!-- Tier 2 -->
      <section class="sbe-card tier-card premium" aria-labelledby="premium-tier-title">
        <span class="popular-tag">Engaged High-Profile</span>
        <h4 id="premium-tier-title" class="tier-name" style="color: var(--um-orange-red);">Alumni Premium</h4>
        <div class="tier-price">
          <span class="price" style="color: var(--um-orange-red);">€9.99</span>
          <span class="period">/ month</span>
        </div>

        <ul class="features-list">
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Receive SBE monthly newsletter</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Update your personal profile</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill"></span> Register for basic alumni events</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> <strong>Complete alumni database search</strong></li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> <strong>Filter by SBE Course & Tutorial Group</strong></li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> <strong>Direct classmates messaging & chat</strong></li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> Priority application for Carl Square vacancies</li>
          <li><span class="iconify check" data-icon="ph:check-circle-fill" style="color: var(--um-orange-red);"></span> Invitations to closed regional gatherings</li>
        </ul>

        <button class="select-tier-btn premium-btn" aria-label="Upgrade to Alumni Premium tier">Upgrade to Premium</button>
      </section>

    </div>
  </div>
</div>
`
  };

  const appViewport = document.getElementById('app-viewport');
  const navItems = document.querySelectorAll('.nav-menu .nav-item[data-page]');

  // Initialize router
  function initRouter() {
    // Check initial hash
    let page = window.location.hash.replace('#', '');
    if (!routes[page]) {
      page = 'feed'; // Default page
      window.location.hash = '#feed';
    }
    loadPage(page);

    // Watch hash change
    window.addEventListener('hashchange', () => {
      const newPage = window.location.hash.replace('#', '');
      if (routes[newPage]) {
        loadPage(newPage);
      }
    });

    // Navigation click handlers
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetPage = item.getAttribute('data-page');
        window.location.hash = `#${targetPage}`;
      });

      // Accessibility key support (Enter / Space)
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const targetPage = item.getAttribute('data-page');
          window.location.hash = `#${targetPage}`;
        }
      });
    });
  }

  // Load page content dynamically via Fetch (with local string fallback)
  async function loadPage(pageName) {
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

    // Show dynamic loading spinner
    appViewport.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; gap: var(--space-4);">
        <span class="iconify" data-icon="svg-spinners:ring-resize" style="font-size: 40px; color: var(--um-orange-red);"></span>
        <p style="font-family: var(--font-heading); font-weight: 600; color: var(--color-text-secondary);">Recalling SBE portal database...</p>
      </div>
    `;

    // 1. Direct local fallback for file:// protocol to avoid CORS errors when opening index.html directly from file explorer
    if (window.location.protocol === 'file:') {
      console.info(`Running on file:// protocol. Bypassing fetch network requests to load built-in fallback template for: ${pageName}`);
      appViewport.innerHTML = fallbacks[pageName];
      initializePageInteractivity(pageName);
      return;
    }

    // 2. Standard server-based dynamic fetch loading
    try {
      const response = await fetch(routes[pageName]);
      if (!response.ok) throw new Error(`Fetch response error ${response.status}`);
      const htmlContent = await response.text();

      // Check if response text looks like a database connection error or server error page
      const trimmedText = htmlContent.trim();
      const looksLikeError = trimmedText.includes("Database Connection Interrupted") || 
                             trimmedText.includes("encountered a problem fetching") ||
                             trimmedText.includes("database snippet") ||
                             !trimmedText.startsWith("<") || 
                             trimmedText.includes("Internal Server Error") ||
                             trimmedText.includes("Error 500");

      if (looksLikeError) {
        throw new Error("Retrieved database snippet contains database connection errors or invalid markup.");
      }

      // Implement native View Transitions if supported
      if (document.startViewTransition) {
        document.startViewTransition(() => {
          appViewport.innerHTML = htmlContent;
          initializePageInteractivity(pageName);
        });
      } else {
        appViewport.innerHTML = htmlContent;
        initializePageInteractivity(pageName);
      }
    } catch (error) {
      console.warn(`Dynamic fetch failed: ${error.message}. Resolving through local fallback template bundle for: ${pageName}`);
      
      // Secondary fallback trigger
      appViewport.innerHTML = fallbacks[pageName];
      initializePageInteractivity(pageName);
    }
  }

  // Initialize specific interactive scripts per component page
  function initializePageInteractivity(pageName) {
    if (pageName === 'feed') {
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
     1. FEED COMPONENT INTERACTIVITY
     ========================================== */
  function initFeedInteractivity() {
    // Like button toggle
    const actionBtns = document.querySelectorAll('.feed-post .action-btn:first-child');
    actionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        const countSpan = btn.closest('.feed-post').querySelector('.likes-count span');
        let currentLikes = parseInt(countSpan.textContent.match(/\d+/)[0]);
        if (btn.classList.contains('active')) {
          btn.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-fill"></span> Liked`;
          countSpan.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-fill"></span> You and ${currentLikes} others`;
        } else {
          btn.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-bold"></span> Like`;
          countSpan.innerHTML = `<span class="iconify" data-icon="ph:thumbs-up-fill"></span> ${currentLikes} SBE alumni`;
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

      alumniCards.forEach(card => {
        let match = true;

        if (selectedSector && card.getAttribute('data-sector') !== selectedSector) {
          match = false;
        }
        if (selectedCourse && card.getAttribute('data-course') !== selectedCourse) {
          match = false;
        }
        if (selectedPeriod && card.getAttribute('data-period') !== selectedPeriod) {
          match = false;
        }
        if (selectedTutorial && card.getAttribute('data-tutorial') !== selectedTutorial) {
          match = false;
        }

        if (match) {
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
    }

    // Event listeners for selects
    [sectorFilter, courseFilter, periodFilter, tutorialFilter].forEach(elem => {
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
        if (btn.classList.contains('connected')) {
          btn.classList.remove('connected');
          btn.textContent = 'Connect';
          btn.style.backgroundColor = 'var(--um-light-blue)';
        } else {
          btn.classList.add('connected');
          btn.textContent = 'Pending';
          btn.style.backgroundColor = 'var(--color-text-muted)';
        }
      });
    });
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
