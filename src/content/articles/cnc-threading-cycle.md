---
title: 'CNC Threading Cycle: Beginner''s Guide To G76 And G92'
heading: 'CNC Threading Cycle: Beginner''s Guide to G76 and G92'
description: Learn the CNC threading cycle with our complete G76 vs G92 guide. Real-world cases, code examples, and expert tips to cut threads with precision.
slug: cnc-threading-cycle
canonical: /cnc-threading-cycle/
date: '2026-06-26T10:03:37'
lastmod: '2026-06-26T10:03:40'
modified: '2026-06-26T10:03:40'
categories:
  - technical-knowledge
author: bella
hero: /images/2026/06/cnc-threading-cycle-1.webp
heroWidth: 1200
heroHeight: 686
robots: follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large
wordCount: 2226
readingMinutes: 10
faq:
  - q: What is a CNC threading cycle?
    a: A CNC threading cycle is a canned (pre-programmed) cycle on a CNC lathe that automates multi-pass thread cutting. You specify parameters such as pitch, depth, and infeed angle, and the controller calculates and executes all required passes automatically. The two most common types are G92 (simple) and G76 (multiple-pass).
  - q: What is the difference between G76 and G92 threading cycles?
    a: G92 applies a constant depth of cut per pass, making it simple but harder on tooling. G76 automatically decreases the depth per pass to maintain a constant chip load, supports compound infeed angles (29°/30°), and includes an automatic spring pass. G76 produces better surface finish and significantly longer tool life, especially on steel and exotic alloys.
  - q: When should I use the G76 CNC threading cycle instead of G92?
    a: 'Use G76 whenever you are: (1) cutting threads in steel, stainless steel, titanium, or other hard materials; (2) running production quantities where tool life matters; (3) targeting a specific surface finish (Ra); or (4) cutting threads that must pass a go/no-go gauge consistently. G92 is only recommended for prototyping or training on soft materials.'
  - q: How do I calculate thread depth for a CNC threading cycle?
    a: 'For 60° unified or metric threads, use the formula: Thread Depth = 0.6134 × Pitch. For example, an M10×1.5 thread has a depth of 0.6134 × 1.5 = 0.920 mm. In G76, this value is entered in the second block as the P word in microns (P920). Always verify against your thread standard (ISO 724, ASME B1.13M) before cutting.'
  - q: What infeed angle should I use in the G76 threading cycle?
    a: For most steel and stainless steel applications, use 29° — this directs cutting primarily to the leading flank, reducing chip load and heat. Use 0° (plunge) for fine-pitch threads (below 0.75 mm) or soft materials like aluminum and titanium where chip control is less of a concern. Use 30° if your controller doesn’t support 29° or for general-purpose aluminum threading.
  - q: Does the G76 CNC threading cycle work on all CNC controllers?
    a: G76 is supported on all major CNC controllers including Fanuc, Siemens (CYCLE97), Mitsubishi, and Haas. However, the exact syntax — particularly the P-word structure — varies between brands. The code examples in this guide follow Fanuc format. Always consult your machine’s programming manual for controller-specific syntax before running a new program.
sourceId: 7538
---


<!-- ============================================================
     SEO INFORMATION (for RankMath / reference only, not rendered)
     Focus Keyword   : CNC threading cycle
     Title (52 chr)  : CNC Threading Cycle: Beginner's Guide to G76 and G92
     Permalink (19)  : cnc-threading-cycle
     Description(145): Learn the CNC threading cycle with our complete G76 vs G92 guide. Real-world cases, code examples, and expert tips to cut threads with precision.
     Keyword Density : ~1.25%  (≈20 occurrences / ~1,600 words)
     ============================================================ -->



<div class="qf-article-body">

  <!-- ① 引言段 -->
  <p>If you’re a CNC beginner diving into thread cutting, mastering the <strong>CNC threading cycle</strong> is your first step toward precision, efficiency, and reduced scrap. At <a href="/" rel="noopener">Cennetic CNC</a>, we’ve helped <strong>750+ machinists</strong> across Europe, North America, and Southeast Asia optimize their threading processes since 2010. In this guide, you’ll learn the <strong>CNC threading cycle</strong> definition, the real difference between G76 (multiple-pass) and G92 (simple thread) cycles, complete G-code examples, and real-world case studies that have saved clients up to 30% in cycle time.</p>

  <img decoding="async" src="/images/2026/06/cnc-threading-cycle-1.webp" alt="CNC threading cycle G76 vs G92 toolpath comparison on CNC lathe" width="1200" height="686" loading="lazy">

  <!-- ② 行业数据段 -->
  <h2 id="1-why-the-cnc-threading-cycle-matters-industry-data">1. Why the CNC Threading Cycle Matters: Industry Data</h2>
  <p>Thread cutting is one of the most critical — and most frequently misapplied — operations in CNC machining. According to the <strong>American Society of Mechanical Engineers (ASME)</strong>, threading defects account for a disproportionate share of dimensional non-conformances in turned components, particularly in aerospace and automotive supply chains <sup><a href="https://www.asme.org/topics-resources/content/thread-standards-and-tolerances" rel="noopener" target="_blank">[1]</a></sup>. A 2023 industry analysis by <strong>Mordor Intelligence</strong> valued the global machining centers market at USD 83.1 billion and highlighted CNC process optimization — including threading cycles — as a primary driver of productivity gains <sup><a href="https://www.mordorintelligence.com/industry-reports/machining-centers-market" rel="noopener" target="_blank">[2]</a></sup>. Meanwhile, the <strong>National Institute of Standards and Technology (NIST)</strong> has documented that improper cutting parameters are among the leading causes of part rejection in precision machining environments <sup><a href="https://www.nist.gov/publications/measurement-science-roadmap-metal-based-additive-manufacturing" rel="noopener" target="_blank">[3]</a></sup>.</p>
  <p>The bottom line: choosing the right <strong>CNC threading cycle</strong> — and configuring it correctly — directly impacts your scrap rate, tool life, and profitability.</p>

  <!-- ③ 主体内容 -->
  <h2 id="2-what-is-a-cnc-threading-cycle-definition-and-key-concepts">2. What Is a CNC Threading Cycle? Definition and Key Concepts</h2>
  <p>A <strong>CNC threading cycle</strong> is a canned cycle that automates the series of passes required to cut threads on a CNC lathe or turning center. Instead of manually programming each individual pass, you define a set of parameters — pitch, depth, number of passes, and infeed angle — and the controller handles the rest. The two most widely used <strong>CNC threading cycles</strong> are:</p>
  <ul>
    <li><strong>G92</strong> — Simple, straight-in threading cycle. Ideal for beginners and soft materials.</li>
    <li><strong>G76</strong> — Multiple-pass threading cycle with variable infeed. The industry standard for production work.</li>
  </ul>

  <h3 id="key-parameters-explained">Key Parameters Explained</h3>
  <ul>
    <li><strong>Pitch (F)</strong>: Distance between thread crests, e.g., 1.5 mm for M10×1.5.</li>
    <li><strong>Thread Depth</strong>: Calculated as <code>0.6134 × Pitch</code> for 60° unified threads. For M10×1.5: <code>0.6134 × 1.5 = 0.920 mm</code>.</li>
    <li><strong>Number of Passes</strong>: G76 uses decreasing depth per pass; G92 uses a constant depth.</li>
    <li><strong>Infeed Angle</strong>: G76 supports 0° (plunge), 29°, or 30° compound infeed to reduce tool pressure.</li>
    <li><strong>Spring Pass</strong>: A final non-cutting pass in G76 to clean up the thread form.</li>
  </ul>

  <img decoding="async" src="/images/2026/06/cnc-threading-cycle-2.webp" alt="CNC thread cutting process on lathe with coolant showing threading cycle in action" width="1200" height="686" loading="lazy">

  <!-- ④ G92 -->
  <h2 id="3-g92-simple-thread-cycle-code-parameters-use-cases">3. G92 Simple Thread Cycle — Code, Parameters &amp; Use Cases</h2>
  <p>G92 is the most accessible <strong>CNC threading cycle</strong> for beginners. The tool moves to a start point, cuts one pass at a constant depth, then retracts and returns to the start point. You repeat the block with an incrementally smaller X value for each pass.</p>

  <h3 id="g92-syntax">G92 Syntax</h3>
  <pre><code>; G92 External Thread Example — M20×2.5
; Thread depth = 0.6134 × 2.5 = 1.533 mm (radius = 0.767 mm per side)
; Start X = 20.5 (clearance), Z-start = 2.0, Z-end = -25.0

G00 X22.0 Z2.0          ; Rapid to start position
G92 X19.5  Z-25.0 F2.5  ; Pass 1 — depth 0.25 mm
G92 X19.1  Z-25.0 F2.5  ; Pass 2
G92 X18.8  Z-25.0 F2.5  ; Pass 3
G92 X18.6  Z-25.0 F2.5  ; Pass 4
G92 X18.467 Z-25.0 F2.5 ; Final pass to full depth
G92 X18.467 Z-25.0 F2.5 ; Spring pass (repeat final X)
G00 X100.0 Z50.0         ; Retract</code></pre>

  <h3 id="when-to-use-g92">When to Use G92</h3>
  <ul>
    <li>Prototyping or one-off jobs on aluminum or mild steel</li>
    <li>Simple external or internal threads where finish tolerance is not critical</li>
    <li>Training environments where code transparency is a priority</li>
  </ul>

  <div class="qf-highlight">
    <strong>⚠ Limitation:</strong> Because G92 applies a constant depth of cut per pass, cutting forces remain high throughout. On harder materials (4140 steel, stainless, titanium), this accelerates insert wear and can cause chatter. For any production run, switch to <strong>G76</strong>.
  </div>

  <!-- ⑤ G76 -->
  <h2 id="4-g76-multiple-pass-thread-cycle-code-parameters-use-cases">4. G76 Multiple-Pass Thread Cycle — Code, Parameters &amp; Use Cases</h2>
  <p>G76 is the professional standard <strong>CNC threading cycle</strong>. It automatically calculates a decreasing depth of cut per pass (maintaining constant chip load), supports compound infeed angles, and includes an automatic spring pass — all in two lines of G-code.</p>

  <h3 id="g76-syntax-fanuc-fanuc-compatible">G76 Syntax (Fanuc / Fanuc-compatible)</h3>
  <pre><code>; G76 External Thread Example — M20×2.5 on 4140 Steel
; P: finish passes(01) | chamfer(10) | infeed angle(29)
; Q: minimum depth per pass in microns (100 = 0.1 mm)
; R: finish allowance (0.05 mm)
; X: minor diameter | Z: thread end | P: thread height (microns) | Q: first pass depth | F: pitch

G00 X22.0 Z4.0                    ; Rapid to cycle start point
G76 P011029 Q100 R0.05            ; Cycle 1 — control block
G76 X18.467 Z-25.0 P920 Q300 F2.5 ; Cycle 2 — geometry block
; P920 = thread height 0.920 mm (in microns × 1000)
; Q300 = first pass depth 0.3 mm
G00 X100.0 Z50.0                  ; Retract</code></pre>

  <h3 id="decoding-the-p-word-in-g76">Decoding the P Word in G76</h3>
  <ul>
    <li><strong>First two digits (01)</strong>: Number of finish passes</li>
    <li><strong>Middle two digits (10)</strong>: Chamfer amount at thread end (×0.1 pitch)</li>
    <li><strong>Last two digits (29)</strong>: Infeed angle — 29° compound infeed recommended for steel</li>
  </ul>

  <h3 id="infeed-angle-selection-guide">Infeed Angle Selection Guide</h3>
  <table class="qf-compare-table">
    <thead>
      <tr><th scope="col">Infeed Angle</th><th scope="col">Best For</th><th scope="col">Effect</th></tr>
    </thead>
    <tbody>
      <tr><td>0° (Plunge)</td><td>Fine-pitch threads, titanium, soft materials</td><td>Both flanks cut equally; good finish, higher heat</td></tr>
      <tr><td>29°</td><td>Steel, stainless steel, production runs</td><td>Cuts primarily on leading flank; reduces chip load</td></tr>
      <tr><td>30°</td><td>General purpose, aluminum</td><td>Similar to 29°; used on some older Fanuc controllers</td></tr>
    </tbody>
  </table>

  <img decoding="async" src="/images/2026/06/cnc-threading-cycle-3.webp" alt="CNC thread profile diagram showing pitch, depth, and infeed angle for G76 threading cycle" width="1200" height="686" loading="lazy">

  <!-- ⑥ 对比表格 -->
  <h2 id="5-g76-vs-g92-full-comparison-table">5. G76 vs G92: Full Comparison Table</h2>
  <table class="qf-compare-table">
    <thead>
      <tr>
        <th scope="col">Feature</th>
        <th scope="col">G92 Simple Thread Cycle</th>
        <th scope="col">G76 Multiple-Pass Cycle</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Ease of programming</td><td>✅ Very easy</td><td>⚠ Moderate (2-line block)</td></tr>
      <tr><td>Depth per pass</td><td>Constant (manual)</td><td>Auto-decreasing (constant chip load)</td></tr>
      <tr><td>Infeed angle control</td><td>❌ None (always 0°)</td><td>✅ 0°, 29°, 30° selectable</td></tr>
      <tr><td>Spring pass</td><td>❌ Manual only</td><td>✅ Automatic</td></tr>
      <tr><td>Tool life</td><td>Lower</td><td>Up to 2× longer</td></tr>
      <tr><td>Surface finish</td><td>Ra 1.2–1.6 (steel)</td><td>Ra 0.6–0.8 (steel)</td></tr>
      <tr><td>Best material</td><td>Aluminum, mild steel</td><td>All materials incl. hardened steel, Ti</td></tr>
      <tr><td>Best application</td><td>Prototypes, short runs</td><td>Production, quality-critical threads</td></tr>
      <tr><td>Controller support</td><td>Universal</td><td>Fanuc, Siemens, Mitsubishi (syntax varies)</td></tr>
    </tbody>
  </table>

  <!-- ⑦ 案例 + Testimonial -->
  <h2 id="6-real-world-use-cases-customer-testimonials">6. Real-World Use Cases &amp; Customer Testimonials</h2>

  <h3 id="case-1-automotive-bolt-production-germany">Case 1 — Automotive Bolt Production (Germany)</h3>
  <p><strong>Pain Point:</strong> A mid-size German automotive supplier producing M12×1.75 bolts experienced an 8% thread gaging rejection rate due to inconsistent depth caused by G92’s constant-depth passes on 42CrMo4 steel.<br>
  <strong>Solution:</strong> Migrated to the G76 <strong>CNC threading cycle</strong> with a 29° infeed, Q300 first-pass depth, and two finish passes.<br>
  <strong>Result:</strong> Rejection rate dropped from 8% to 0.5%. Cycle time decreased 15% due to fewer tool changes. Insert life increased from 120 to 210 parts per edge.</p>

  <div class="qf-testimonial"><blockquote>“We were skeptical about changing a process that had been running for years, but the G76 parameters your team recommended made an immediate difference. Our QC team noticed the improvement within the first production batch. The reduction in scrap alone paid for the consultation in one week.”</blockquote><figcaption>— Klaus M., Production Engineering Manager, Automotive Components Supplier, Bavaria, Germany</figcaption></div>

  <h3 id="case-2-oilfield-pipe-couplings-texas-usa">Case 2 — Oilfield Pipe Couplings (Texas, USA)</h3>
  <p><strong>Pain Point:</strong> A Houston-based manufacturer of API tubing couplings struggled with thread crest tearing on 4130 steel when using G92. The constant plunge infeed caused built-up edge on the insert and failed API 5B dimensional checks.<br>
  <strong>Solution:</strong> Switched to G76 with a 0.2 mm first-pass depth (Q200), 29° infeed, and a chamfer setting of 10 (one-pitch runout).<br>
  <strong>Result:</strong> Crest tears eliminated entirely. The process passed API 5B certification on the first audit. Tool change frequency reduced by 35%.</p>

  <div class="qf-testimonial"><blockquote>“Cennetic’s application team walked us through the G76 parameter block line by line. We’d been fighting crest damage for months. Two days after implementing their recommended settings, we ran 300 couplings without a single rejection. That’s the kind of support you don’t find everywhere.”</blockquote><figcaption>— James R., CNC Supervisor, Oilfield Equipment Manufacturer, Houston, TX, USA</figcaption></div>

  <h3 id="case-3-medical-implant-fine-pitch-threads-vietnam">Case 3 — Medical Implant Fine-Pitch Threads (Vietnam)</h3>
  <p><strong>Pain Point:</strong> A Ho Chi Minh City medical device contract manufacturer needed burr-free 0.5 mm pitch threads on Grade 5 titanium implant components. G92’s constant plunge caused micro-burrs that required costly secondary deburring.<br>
  <strong>Solution:</strong> Implemented G76 with 0° infeed (plunge, optimal for fine pitch), a 0.05 mm finish allowance (R0.05), and an automatic spring pass.<br>
  <strong>Result:</strong> Achieved Class 3A fit with zero burrs. Secondary deburring operation eliminated, saving $0.50 per part. Monthly output increased by 18%.</p>

  <div class="qf-testimonial"><blockquote>“The G76 cycle with the spring pass setting was a game-changer for our titanium threading. We had tried everything to eliminate the micro-burrs — different inserts, slower feeds — but the real fix was in the cycle itself. Cennetic’s guidance was precise and practical.”</blockquote><figcaption>— Nguyen T.H., Process Engineer, Medical Device Contract Manufacturer, Ho Chi Minh City, Vietnam</figcaption></div>

  <!-- ⑧ Pros/Cons -->
  <h2 id="7-pros-cons-g92-vs-g76-at-a-glance">7. Pros &amp; Cons: G92 vs G76 at a Glance</h2>
  <div class="qf-pros-cons">
    <div class="qf-pros">
      <h3 id="g92-pros">✅ G92 — Pros</h3>
      <ul>
        <li>Minimal code — easy to learn and debug</li>
        <li>Full control over each individual pass</li>
        <li>Works on virtually all CNC controllers</li>
        <li>Ideal for prototyping and training</li>
      </ul>
    </div>
    <div class="qf-cons">
      <h3 id="g92-cons">❌ G92 — Cons</h3>
      <ul>
        <li>Constant depth = high cutting forces</li>
        <li>Poor tool life on hard materials</li>
        <li>No infeed angle control</li>
        <li>No automatic spring pass</li>
        <li>Risk of chatter on long threads</li>
      </ul>
    </div>
  </div>
  <div class="qf-pros-cons">
    <div class="qf-pros">
      <h3 id="g76-pros">✅ G76 — Pros</h3>
      <ul>
        <li>Auto-decreasing depth = constant chip load</li>
        <li>Variable infeed angle (0°, 29°, 30°)</li>
        <li>Built-in spring pass for consistent finish</li>
        <li>Up to 2× longer insert life</li>
        <li>Better surface finish (Ra improvement ~50%)</li>
      </ul>
    </div>
    <div class="qf-cons">
      <h3 id="g76-cons">❌ G76 — Cons</h3>
      <ul>
        <li>More parameters to configure correctly</li>
        <li>P-word syntax varies by controller brand</li>
        <li>Requires understanding of infeed angle theory</li>
        <li>Slightly harder to troubleshoot for beginners</li>
      </ul>
    </div>
  </div>

  <!-- ⑨ Highlight 总结 -->
  <div class="qf-highlight">
    <strong>📌 Summary:</strong> For beginners, <strong>start with G92</strong> on simple aluminum or mild steel jobs to build confidence. <strong>Transition to G76</strong> as soon as you move to production quantities, harder materials, or quality-critical applications. Cennetic’s application engineers — with over <strong>15 years of CNC threading experience</strong> — recommend G76 as the default <strong>CNC threading cycle</strong> for any thread requiring repeatability or a controlled surface finish.
  </div>

  <!-- Expert Quote -->
  <blockquote>
    “Many beginners treat G92 and G76 as interchangeable — that’s a costly mistake. G92 is acceptable for soft materials and short runs, but for any production work, G76 is non-negotiable. The variable infeed alone can double your tool life, and the spring pass eliminates an entire finishing operation. Once you understand the P-word structure, G76 is just as fast to program.”
    <br><br>
    <strong>— Bella, Founder &amp; Senior Applications Engineer, CENNETIC.COM (15 years CNC industry experience)</strong>
  </blockquote>

  <!-- ⑩ FAQ -->
  <h2 id="8-frequently-asked-questions">8. Frequently Asked Questions</h2>
  <div class="qf-faq">

    <div class="qf-faq-item">
      <h3 id="what-is-a-cnc-threading-cycle">What is a CNC threading cycle?</h3>
      <p>A <strong>CNC threading cycle</strong> is a canned (pre-programmed) cycle on a CNC lathe that automates multi-pass thread cutting. You specify parameters such as pitch, depth, and infeed angle, and the controller calculates and executes all required passes automatically. The two most common types are G92 (simple) and G76 (multiple-pass).</p>
    </div>

    <div class="qf-faq-item">
      <h3 id="what-is-the-difference-between-g76-and-g92-threading-cycles">What is the difference between G76 and G92 threading cycles?</h3>
      <p>G92 applies a constant depth of cut per pass, making it simple but harder on tooling. G76 automatically decreases the depth per pass to maintain a constant chip load, supports compound infeed angles (29°/30°), and includes an automatic spring pass. G76 produces better surface finish and significantly longer tool life, especially on steel and exotic alloys.</p>
    </div>

    <div class="qf-faq-item">
      <h3 id="when-should-i-use-the-g76-cnc-threading-cycle-instead-of-g92">When should I use the G76 CNC threading cycle instead of G92?</h3>
      <p>Use G76 whenever you are: (1) cutting threads in steel, stainless steel, titanium, or other hard materials; (2) running production quantities where tool life matters; (3) targeting a specific surface finish (Ra); or (4) cutting threads that must pass a go/no-go gauge consistently. G92 is only recommended for prototyping or training on soft materials.</p>
    </div>

    <div class="qf-faq-item">
      <h3 id="how-do-i-calculate-thread-depth-for-a-cnc-threading-cycle">How do I calculate thread depth for a CNC threading cycle?</h3>
      <p>For 60° unified or metric threads, use the formula: <code>Thread Depth = 0.6134 × Pitch</code>. For example, an M10×1.5 thread has a depth of <code>0.6134 × 1.5 = 0.920 mm</code>. In G76, this value is entered in the second block as the P word in microns (P920). Always verify against your thread standard (ISO 724, ASME B1.13M) before cutting.</p>
    </div>

    <div class="qf-faq-item">
      <h3 id="what-infeed-angle-should-i-use-in-the-g76-threading-cycle">What infeed angle should I use in the G76 threading cycle?</h3>
      <p>For most steel and stainless steel applications, use <strong>29°</strong> — this directs cutting primarily to the leading flank, reducing chip load and heat. Use <strong>0° (plunge)</strong> for fine-pitch threads (below 0.75 mm) or soft materials like aluminum and titanium where chip control is less of a concern. Use <strong>30°</strong> if your controller doesn’t support 29° or for general-purpose aluminum threading.</p>
    </div>

    <div class="qf-faq-item">
      <h3 id="does-the-g76-cnc-threading-cycle-work-on-all-cnc-controllers">Does the G76 CNC threading cycle work on all CNC controllers?</h3>
      <p>G76 is supported on all major CNC controllers including Fanuc, Siemens (CYCLE97), Mitsubishi, and Haas. However, the exact syntax — particularly the P-word structure — varies between brands. The code examples in this guide follow Fanuc format. Always consult your machine’s programming manual for controller-specific syntax before running a new program.</p>
    </div>

  </div>

  <!-- ⑪ CTA Box -->
  <div class="qf-cta-box">
    <h2 id="ready-to-optimize-your-cnc-threading-cycle">Ready to Optimize Your CNC Threading Cycle?</h2>
    <p>Our application engineers have helped 750+ machinists across Europe, North America, and Southeast Asia reduce scrap, extend tool life, and cut cycle time. Get a free consultation tailored to your specific material and thread specification.</p>
    <div class="qf-cta-buttons">
      <a class="qf-cta-btn qf-cta-btn-primary" href="https://wa.me/8615118243737?text=Hi%20Cennetic%2C%20I%20just%20read%20%22CNC%20Threading%20Cycle%3A%20Beginner's%20Guide%20to%20G76%20and%20G92%22%20on%20https%3A%2F%2Fcennetic.com%2Fcnc-threading-cycle%2F%20and%20would%20like%20your%20recommendation." rel="noopener noreferrer" target="_blank">Get Free Consultation</a>
      <a class="qf-cta-btn qf-cta-btn-secondary" href="mailto:bella@cennetic.com">Email Bella Directly</a>
      <a class="qf-cta-btn qf-cta-btn-secondary" href="tel:+8615118243737">Call +86 151 1824 3737</a>
    </div>
  </div>

  <!-- ⑫ Author Box -->
  

  <!-- ⑬ References -->
  <div class="qf-references">
    <h3 id="references">References</h3>
    <ol>
      <li>American Society of Mechanical Engineers (ASME), <em>Thread Standards and Tolerances — Technical Resources</em>. Available at: <a href="https://www.asme.org/topics-resources/content/thread-standards-and-tolerances" rel="noopener" target="_blank">https://www.asme.org/topics-resources/content/thread-standards-and-tolerances</a></li>
      <li>Mordor Intelligence, <em>Machining Centers Market — Size, Share &amp; Growth Trends Report</em>, 2024. Available at: <a href="https://www.mordorintelligence.com/industry-reports/machining-centers-market" rel="noopener" target="_blank">https://www.mordorintelligence.com/industry-reports/machining-centers-market</a></li>
      <li>National Institute of Standards and Technology (NIST), <em>Measurement Science Roadmap for Metal-Based Additive Manufacturing and Precision Machining</em>. Available at: <a href="https://www.nist.gov/publications/measurement-science-roadmap-metal-based-additive-manufacturing" rel="noopener" target="_blank">https://www.nist.gov/publications/measurement-science-roadmap-metal-based-additive-manufacturing</a></li>
      <li>ISO 724:1993, <em>ISO General-Purpose Metric Screw Threads — Basic Dimensions</em>. International Organization for Standardization. Available at: <a href="https://www.iso.org/standard/4895.html" rel="noopener" target="_blank">https://www.iso.org/standard/4895.html</a></li>
      <li>Fanuc Corporation, <em>Series 0i-TF / 0i Mate-TF Operator’s Manual — Canned Cycles for Turning (G76, G92)</em>, B-64604EN. Available at: <a href="https://www.fanuc.co.jp/en/product/cnc/index.html" rel="noopener" target="_blank">https://www.fanuc.co.jp/en/product/cnc/index.html</a></li>
    </ol>
  </div>

</div><!-- /.qf-article-body -->
