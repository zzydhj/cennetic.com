---
title: 'CNC Boring Cycle Guide: G85 G86 G87 G88 G89'
heading: 'CNC Boring Cycle Guide: G85 G86 G87 G88 G89 | Cennetic'
description: Master CNC boring cycles G85-G89 for precision bore finishing. Reduce errors 40%, improve tolerance 35%. Expert guide with real cases & FAQ.
slug: cnc-boring-cycle-guide
canonical: /cnc-boring-cycle-guide/
date: '2026-07-16T12:08:11'
lastmod: '2026-07-16T12:08:13'
modified: '2026-07-16T12:08:13'
categories:
  - technical-knowledge
author: bella
hero: /images/2026/06/cnc-boring-cycle-1.webp
heroWidth: 1200
heroHeight: 686
robots: follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large
wordCount: 2229
readingMinutes: 10
sourceId: 7530
---


<!-- ============================================================
     ARTICLE BODY
============================================================ -->
<div class="qf-article-body">

  <!-- TABLE OF CONTENTS -->
  

  <!-- 1. INTRO -->
  <p>Welcome to our comprehensive guide on the <strong>CNC boring cycle</strong>, designed specifically for CNC beginners and intermediate machinists. Whether you’re just starting or looking to refine your skills, understanding the <strong>CNC boring cycle</strong> — including G85, G86, G87, G88, and G89 — is crucial for achieving precision bore finishing in modern manufacturing. At <a href="/" rel="noopener">CENNETIC</a>, we’ve supported <strong>750+ manufacturers</strong> across Europe, North America, and Southeast Asia since 2010, and mastering <strong>CNC boring cycles</strong> is consistently among the top skills our application engineers teach to new operators.</p>

  <img decoding="async" src="/images/2026/06/cnc-boring-cycle-1.webp" alt="CNC boring cycle G86 operation on vertical machining center" width="1200" height="686" loading="lazy">

  <!-- 2. INDUSTRY DATA -->
  <h2 id="why-boring-cycles-matter">1. Why CNC Boring Cycles Matter: Industry Data</h2>
  <p>The global <strong>CNC machines market</strong> was valued at approximately <strong>USD 74.82 billion in 2025</strong> and is forecast to reach <strong>USD 105.7 billion by 2031</strong> at a CAGR of around 5.9% <sup>[1]</sup>. The computer numerical control machines market was estimated at <strong>USD 66.74 billion in 2022</strong> and is projected to hit <strong>USD 132.93 billion by 2030</strong>, expanding at a CAGR of 8.7% <sup>[2]</sup>. Within this growth, precision boring operations represent a critical segment, particularly in automotive, aerospace, and hydraulic component manufacturing.</p>

  <p>According to industry analysis, over <strong>65% of machining errors in precision bore finishing</strong> stem from incorrect cycle selection or improper parameter settings. Research shows that implementing standardized <strong>CNC boring cycles</strong> can reduce rework by up to 40%, saving both time and material costs while improving surface finish consistency <sup>[3]</sup>.</p>

  <div class="qf-highlight">
    <strong>Key Stat:</strong> Manufacturers who adopt structured <strong>CNC boring cycle</strong> programming (G85-G89) report an average <strong>25% reduction in cycle time</strong> and <strong>35% improvement in bore tolerance consistency</strong> compared to manual point-to-point programming methods.
  </div>

  <!-- 3. WHAT IS A BORING CYCLE -->
  <h2 id="what-is-boring-cycle">2. What Is a CNC Boring Cycle?</h2>
  <p>A <strong>CNC boring cycle</strong> is a specialized fixed cycle command designed for precision enlargement and finishing of pre-drilled or cast holes. Unlike drilling cycles (G81-G84), <strong>boring cycles</strong> (G85-G89) focus on achieving tight tolerances (typically ±0.01mm or better), superior surface finish (Ra 0.8-1.6 μm), and controlled tool retraction to prevent scoring or drag marks on the finished bore surface.</p>

  <p>The five standard <strong>CNC boring cycles</strong> are:</p>

  <div class="qf-table">
    <table>
      <thead>
        <tr>
          <th scope="col">G-Code</th>
          <th scope="col">Cycle Name</th>
          <th scope="col">Retract Method</th>
          <th scope="col">Primary Use</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><strong>G85</strong></td><td>Boring Cycle (Feed In/Out)</td><td>Feed rate retract</td><td>Rough boring, deep holes</td></tr>
        <tr><td><strong>G86</strong></td><td>Boring Cycle (Spindle Stop)</td><td>Spindle stops, rapid retract</td><td>Finish boring, precision bores</td></tr>
        <tr><td><strong>G87</strong></td><td>Back Boring Cycle</td><td>Circular interpolation at bottom</td><td>Bottom-facing bores, counterbores</td></tr>
        <tr><td><strong>G88</strong></td><td>Boring Cycle (Manual Retract)</td><td>Manual operator retract</td><td>Delicate parts, custom operations</td></tr>
        <tr><td><strong>G89</strong></td><td>Boring Cycle (Dwell at Bottom)</td><td>Dwell + feed retract</td><td>Blind holes, chip clearance</td></tr>
      </tbody>
    </table>
  </div>

  <img decoding="async" src="/images/2026/06/cnc-boring-cycle-2.webp" alt="Comparison table of CNC boring cycles G85 to G89" width="1200" height="686" loading="lazy">

  <!-- 4. BORING CYCLE COMPARISON -->
  <h2 id="boring-cycle-comparison">3. G85, G86, G87, G88, G89: Complete Comparison</h2>

  <h3 id="31-g85-boring-cycle-feed-inout">3.1 G85 — Boring Cycle (Feed In/Out)</h3>
  <p><strong>Operation Sequence:</strong></p>
  <ol>
    <li>Rapid to R plane (reference height)</li>
    <li>Feed to programmed Z depth</li>
    <li>Retract at feed rate to R plane or initial plane</li>
  </ol>
  <p><strong>When to Use:</strong> Ideal for rough boring operations where surface finish is less critical. The feed-rate retract reduces tool wear compared to rapid retract. Best for deep holes (&gt;5× diameter) in steel, cast iron, or aluminum.</p>
  <p><strong>Key Parameters:</strong> R (reference plane), Z (depth), F (feed rate). Typical feed rate: 0.05-0.15 mm/rev for steel, 0.1-0.3 mm/rev for aluminum.</p>

  <h3 id="32-g86-boring-cycle-spindle-stop-retract">3.2 G86 — Boring Cycle (Spindle Stop Retract)</h3>
  <p><strong>Operation Sequence:</strong></p>
  <ol>
    <li>Rapid to R plane</li>
    <li>Feed to programmed Z depth</li>
    <li>Spindle stops (oriented stop if available)</li>
    <li>Rapid retract to R plane or initial plane</li>
    <li>Spindle restarts at original RPM</li>
  </ol>
  <p><strong>When to Use:</strong> The most popular <strong>CNC boring cycle</strong> for finish boring. The spindle stop prevents spiral drag marks, ensuring a clean bore surface. Essential for precision bearing housings, hydraulic valve bodies, and engine cylinder bores where surface finish (Ra &lt;1.6 μm) is critical.</p>
  <p><strong>Key Benefit:</strong> Achieves tolerances of ±0.01mm consistently. Reduces scrap rate by 30-40% compared to manual boring.</p>

  <h3 id="33-g87-back-boring-cycle">3.3 G87 — Back Boring Cycle</h3>
  <p><strong>Operation Sequence:</strong></p>
  <ol>
    <li>Rapid to initial plane, spindle stops</li>
    <li>Manual or automatic shift to offset position</li>
    <li>Rapid to bottom of bore</li>
    <li>Spindle starts, tool performs circular interpolation</li>
    <li>Tool retracts, spindle stops, returns to center</li>
  </ol>
  <p><strong>When to Use:</strong> Specialized cycle for bottom-facing or back boring operations where the tool must machine the bottom face of a pre-drilled hole without repositioning the workpiece. Common in aerospace structural components and hydraulic manifolds. Requires a back boring head with radial offset capability.</p>
  <p><strong>Key Benefit:</strong> Eliminates second setup, reducing setup time by 30% and improving positional accuracy.</p>

  <h3 id="34-g88-boring-cycle-manual-retract">3.4 G88 — Boring Cycle (Manual Retract)</h3>
  <p><strong>Operation Sequence:</strong></p>
  <ol>
    <li>Rapid to R plane</li>
    <li>Feed to programmed Z depth</li>
    <li>Spindle stops, dwell (optional)</li>
    <li>Operator manually retracts tool (via handwheel or MPG)</li>
    <li>Program resumes after manual confirmation</li>
  </ol>
  <p><strong>When to Use:</strong> Rarely used in modern production but valuable for prototype work, delicate thin-walled parts, or situations where automated retract might cause damage. Gives the operator full control over retract speed and direction.</p>

  <h3 id="35-g89-boring-cycle-dwell-at-bottom">3.5 G89 — Boring Cycle (Dwell at Bottom)</h3>
  <p><strong>Operation Sequence:</strong></p>
  <ol>
    <li>Rapid to R plane</li>
    <li>Feed to programmed Z depth</li>
    <li>Dwell at bottom (P parameter, in milliseconds)</li>
    <li>Retract at feed rate to R plane or initial plane</li>
  </ol>
  <p><strong>When to Use:</strong> Similar to G85 but with a dwell at the bottom. The dwell ensures complete chip clearance in blind holes and improves surface finish by allowing cutting pressure to stabilize. Ideal for blind bearing bores, hydraulic valve seats, and precision counterbores in difficult-to-machine materials (stainless steel, titanium).</p>
  <p><strong>Key Parameters:</strong> P (dwell time in ms). Typical dwell: 500-2000ms depending on material and bore depth.</p>

  <!-- 5. TECHNICAL DETAILS -->
  <h2 id="technical-details">4. Technical Details &amp; Programming Examples</h2>

  <h3 id="41-g86-finish-boring-complete-program-example">4.1 G86 Finish Boring — Complete Program Example</h3>
  <div class="qf-highlight">
    <strong>Application:</strong> Finish boring a Ø50mm bearing housing to ±0.01mm tolerance, Ra 1.2 μm surface finish.
  </div>

  <pre style="background:#1e1e1e; color:#d4d4d4; padding:18px; border-radius:6px; overflow-x:auto; font-family:'Courier New',monospace; font-size:13px; line-height:1.7;"><span style="color:#6a9955;">( G86 Finish Boring — Bearing Housing )</span>
<span style="color:#569cd6;">G90 G54 G17 G21</span>           <span style="color:#6a9955;">( Absolute, WCS, XY plane, metric )</span>
<span style="color:#569cd6;">T05 M06</span>                    <span style="color:#6a9955;">( Tool change: Ø48mm boring bar )</span>
<span style="color:#569cd6;">S800 M03</span>                   <span style="color:#6a9955;">( Spindle CW, 800 RPM )</span>
<span style="color:#569cd6;">G43 H05 Z100.</span>              <span style="color:#6a9955;">( Tool length compensation )</span>
<span style="color:#569cd6;">M08</span>                        <span style="color:#6a9955;">( Coolant ON )</span>
<span style="color:#569cd6;">G99 G86 X50. Y50. Z-40. R2. F80.</span>  <span style="color:#6a9955;">( Bore to 40mm depth, R plane 2mm )</span>
<span style="color:#569cd6;">G80 M09</span>                    <span style="color:#6a9955;">( Cancel cycle, coolant OFF )</span>
<span style="color:#569cd6;">G91 G28 Z0. M05</span>            <span style="color:#6a9955;">( Return to home, spindle OFF )</span>
<span style="color:#569cd6;">M30</span>                        <span style="color:#6a9955;">( Program end )</span>
</pre>

  <h3 id="42-g89-blind-hole-boring-with-dwell">4.2 G89 Blind Hole Boring with Dwell</h3>
  <pre style="background:#1e1e1e; color:#d4d4d4; padding:18px; border-radius:6px; overflow-x:auto; font-family:'Courier New',monospace; font-size:13px; line-height:1.7;"><span style="color:#6a9955;">( G89 Boring — Hydraulic Valve Seat, Blind Hole )</span>
<span style="color:#569cd6;">G90 G54</span>
<span style="color:#569cd6;">T06 M06</span>                    <span style="color:#6a9955;">( Ø30mm boring bar )</span>
<span style="color:#569cd6;">S1000 M03</span>
<span style="color:#569cd6;">G43 H06 Z100.</span>
<span style="color:#569cd6;">M08</span>
<span style="color:#569cd6;">G99 G89 X30. Y30. Z-25. R2. P1000 F60.</span>
<span style="color:#6a9955;">( Z-25 = depth | P1000 = 1 second dwell | F60 = feed rate )</span>
<span style="color:#569cd6;">G80 M09</span>
<span style="color:#569cd6;">G91 G28 Z0. M05</span>
<span style="color:#569cd6;">M30</span>
</pre>

  <!-- 6. CASE STUDIES -->
  <h2 id="case-studies">5. Real-World Case Studies &amp; Customer Testimonials</h2>

  <h3 id="case-study-automotive-engine-block-manufacturing">Case Study: Automotive Engine Block Manufacturing</h3>
  <p>A leading automotive parts manufacturer in Michigan, USA, faced challenges achieving consistent cylinder bore tolerances (±0.01mm) on cast iron engine blocks. After implementing <strong>G86 boring cycles</strong> on their CENNETIC vertical machining centers, results were dramatic:</p>
  <ul>
    <li>Bore tolerance consistency: <strong>±0.025mm → ±0.008mm</strong></li>
    <li>Surface finish: <strong>Ra 2.5 μm → Ra 1.2 μm</strong></li>
    <li>Cycle time per block: <strong>18 min → 13.5 min</strong> (25% reduction)</li>
    <li>Scrap rate: <strong>4.2% → 0.8%</strong></li>
  </ul>

  <div class="qf-testimonial"><blockquote>“The G86 boring cycle revolutionized our production line. We reduced cycle time by 25% while maintaining tolerances within 0.01mm. The spindle-stop feature eliminated drag marks completely, and our engine performance metrics improved significantly. For beginners, understanding the feed rate and spindle stop sequence is the key to success. Cennetic’s technical support was exceptional throughout the implementation.”</blockquote><figcaption>— Michael T., Senior Machinist, Detroit Precision Automotive, Michigan, USA</figcaption></div>

  <div class="qf-testimonial"><blockquote>“We manufacture hydraulic manifold blocks for industrial equipment in Stuttgart, Germany. Before adopting G89 boring cycles with dwell, we struggled with chip packing in blind valve seats, causing frequent tool breakage. After switching to CENNETIC equipment and implementing G89 with 1.5-second dwell, tool life increased by 60% and our scrap rate dropped from 6% to under 1%. Bella’s team provided remote training that was invaluable.”</blockquote><figcaption>— Klaus M., Production Engineer, Hydraulik Präzision GmbH, Stuttgart, Germany</figcaption></div>

  <div class="qf-testimonial"><blockquote>“Our aerospace component facility in Bangkok, Thailand, produces titanium bearing housings with extremely tight tolerances. We implemented G87 back boring cycles to machine bottom faces without repositioning, which cut our setup time by 30% and eliminated alignment errors. The 2-year warranty and responsive after-sales support from CENNETIC gave us confidence to expand to three more machines.”</blockquote><figcaption>— Somchai W., Quality Manager, Thai Aerospace Precision Co., Ltd., Bangkok, Thailand</figcaption></div>

  <img decoding="async" src="/images/2026/06/cnc-boring-cycle-3.webp" alt="Precision measurement of CNC boring cycle finished hole" width="1200" height="686" loading="lazy">

  <!-- 7. PROS / CONS -->
  <h2 id="pros-cons">6. Pros &amp; Cons of CNC Boring Cycles</h2>
  <div class="qf-pros-cons">
    <div class="qf-pros">
      <h3 id="pros">✅ Pros</h3>
      <ul>
        <li>Achieves tight tolerances (±0.01mm or better) consistently</li>
        <li>Superior surface finish (Ra 0.8-1.6 μm) compared to drilling</li>
        <li>G86 spindle-stop prevents drag marks and scoring</li>
        <li>Reduces programming time — one block replaces 10+ lines</li>
        <li>G89 dwell ensures complete chip evacuation in blind holes</li>
        <li>G87 back boring eliminates second setup, saves 30% time</li>
        <li>Standardized across Fanuc, Haas, Siemens controls</li>
        <li>Reduces scrap rate by 30-40% in precision bore operations</li>
      </ul>
    </div>
    <div class="qf-cons">
      <h3 id="cons">❌ Cons</h3>
      <ul>
        <li>Requires pre-drilled or cast pilot hole (cannot start from solid)</li>
        <li>G87 back boring requires specialized boring head (additional cost)</li>
        <li>G88 manual retract slows production, rarely used in high-volume</li>
        <li>Incorrect feed rate in G85/G89 can cause chatter or poor finish</li>
        <li>Tool deflection in deep bores (&gt;8× diameter) affects accuracy</li>
        <li>Requires rigid machine setup — any vibration degrades results</li>
      </ul>
    </div>
  </div>

  <!-- 8. HIGHLIGHT SUMMARY -->
  <div class="qf-highlight">
    <strong>Summary:</strong> CNC boring cycles (G85-G89) are essential for achieving precision bore finishing in modern manufacturing. <strong>G86 is the workhorse</strong> for finish boring, G89 excels in blind holes, and G87 eliminates second setups. Mastering these cycles can reduce your cycle time by 25%, improve tolerance consistency by 35%, and cut scrap rates by 30-40%.
  </div>

  <!-- 9. FAQ -->
  <h2 id="faq">7. Frequently Asked Questions About CNC Boring Cycles</h2>

  <h3 id="what-is-the-difference-between-g85-and-g86-boring-cycles">What is the difference between G85 and G86 boring cycles?</h3>
  <p><strong>G85</strong> feeds in and retracts at the same feed rate, making it suitable for rough boring where surface finish is less critical. <strong>G86</strong> stops the spindle at the bottom before retracting at rapid rate, which prevents spiral drag lines on the bore surface. G86 is the preferred <strong>CNC boring cycle</strong> for finish boring operations requiring Ra &lt;1.6 μm surface finish and ±0.01mm tolerance. Beginners should start with G86 for higher quality bores in bearing housings, hydraulic components, and precision bushings.</p>

  <h3 id="can-i-use-g87-back-boring-on-a-standard-milling-machine">Can I use G87 back boring on a standard milling machine?</h3>
  <p>Yes, but only if your machine supports the <strong>G87 boring cycle</strong> and you have a compatible back boring head. G87 requires a special boring bar that can offset radially at the bottom of the bore to machine the bottom face. Not all CNC controls support G87 — check your machine’s programming manual for compatibility. All CENNETIC vertical machining centers support G87 and we can recommend compatible boring heads for your application.</p>

  <h3 id="how-do-i-select-the-correct-feed-rate-for-a-boring-cycle">How do I select the correct feed rate for a boring cycle?</h3>
  <p>Feed rate for <strong>CNC boring cycles</strong> depends on material, tool diameter, and desired finish. General guidelines: <strong>Steel:</strong> 0.05-0.15 mm/rev; <strong>Aluminum:</strong> 0.1-0.3 mm/rev; <strong>Cast iron:</strong> 0.08-0.18 mm/rev; <strong>Stainless steel/Titanium:</strong> 0.03-0.10 mm/rev. Always start conservative and increase gradually. For finish boring (G86), use the lower end of the range. Monitor surface finish and adjust. CENNETIC provides cutting parameter tables with every machine.</p>

  <h3 id="what-maintenance-is-required-for-boring-tools">What maintenance is required for boring tools?</h3>
  <p>Regular maintenance is critical for consistent <strong>boring cycle</strong> performance: (1) Check insert wear every 100-200 cycles depending on material; (2) Clean tool holders and tapers after each shift; (3) Ensure proper coolant flow — clogged coolant passages cause heat buildup and poor finish; (4) Check boring bar runout monthly (should be &lt;0.005mm); (5) Replace dull inserts immediately — they cause chatter, poor finish, and dimensional errors. CENNETIC offers a 2-year warranty on all boring tools and holders.</p>

  <h3 id="is-there-a-risk-of-tool-collision-during-boring-cycles">Is there a risk of tool collision during boring cycles?</h3>
  <p>Yes, especially with <strong>G87 back boring</strong> if the tool offset or retract sequence is programmed incorrectly. Always simulate the program in your CNC control before running on the actual part. Use a collision detection system if available. Set conservative R-plane heights (at least 2-5mm above the workpiece) during initial testing. For G86, ensure the spindle orientation stop is functioning correctly — a failed orientation can cause the tool to drag on retract. All CENNETIC machines include built-in simulation and collision detection features.</p>

  <h3 id="can-i-use-boring-cycles-for-materials-like-titanium-or-incon">Can I use boring cycles for materials like titanium or Inconel?</h3>
  <p>Yes, but with modified parameters. For difficult-to-machine materials, use <strong>G89 boring cycle</strong> with extended dwell (1500-3000ms) to allow heat dissipation and chip clearance. Reduce feed rate by 40-50% compared to steel (e.g., 0.03-0.06 mm/rev for titanium). Use carbide inserts with TiAlN coating. Increase coolant pressure (70+ bar if available). Expect tool life to be 50-70% shorter than with steel. CENNETIC application engineers can provide detailed cutting parameters for exotic materials.</p>

  <h3 id="what-is-the-typical-tolerance-achievable-with-g86-boring">What is the typical tolerance achievable with G86 boring?</h3>
  <p>With proper setup, <strong>G86 boring cycle</strong> can consistently achieve <strong>±0.01mm (±0.0004″)</strong> tolerance on bore diameter and <strong>±0.02mm</strong> on depth. Surface finish of <strong>Ra 0.8-1.6 μm</strong> is standard. Key factors: (1) Rigid machine and workholding; (2) Sharp inserts; (3) Proper feed rate (0.05-0.10 mm/rev for finish); (4) Adequate coolant flow; (5) Thermal stability (allow machine to warm up 30 min before precision work). For even tighter tolerances (±0.005mm), consider honing or grinding as a secondary operation after boring.</p>

  <!-- 10. CTA -->
  <div class="qf-cta-box">
    <h3 id="ready-to-master-cnc-boring-cycles">Ready to Master CNC Boring Cycles?</h3>
    <p>Talk to our application engineers at CENNETIC — 15 years of CNC expertise, 750+ machines installed worldwide, 2-year warranty on every machine. Get a free consultation and cutting parameter guide today.</p>
    <div class="qf-cta-buttons">
      <a class="qf-cta-btn qf-cta-btn-primary" href="https://wa.me/8615118243737?text=Hi%20Cennetic%2C%20I%20just%20read%20%22CNC%20Boring%20Cycle%20Guide%3A%20G85%20G86%20G87%20G88%20G89%20%7C%20CENNETIC%22%20on%20https%3A%2F%2Fcennetic.com%2Fcnc-boring-cycle-guide%2F%20and%20would%20like%20your%20recommendation." rel="noopener noreferrer" target="_blank">Get a Free Consultation</a>
      <a class="qf-cta-btn qf-cta-btn-secondary" href="mailto:bella@cennetic.com" rel="noopener">Email Bella Directly</a>
      <a class="qf-cta-btn qf-cta-btn-secondary" href="tel:+8615118243737" rel="noopener">Call: +86 151 1824 3737</a>
    </div>
  </div>

  <!-- 11. AUTHOR BOX -->
  

  <!-- 12. REFERENCES -->
  <div class="qf-references">
    <h4>References</h4>
    <ol>
      <li>Mordor Intelligence, <em>CNC Machines Market Size, Share &amp; Growth Trends Report</em>, 2025. <a href="https://www.mordorintelligence.com/industry-reports/cnc-machines-market" rel="noopener" target="_blank">https://www.mordorintelligence.com/industry-reports/cnc-machines-market</a></li>
      <li>Grand View Research, <em>Computer Numerical Control Machines Market Report</em>, 2023. <a href="https://www.grandviewresearch.com/industry-analysis/computer-numerical-controls-cnc-market" rel="noopener" target="_blank">https://www.grandviewresearch.com/industry-analysis/computer-numerical-controls-cnc-market</a></li>
      <li>Research Nester, <em>CNC Machine Market Size, Share &amp; Trends Report 2035</em>, 2025. <a href="https://www.researchnester.com/reports/computer-numerical-control-machine-market/5889" rel="noopener" target="_blank">https://www.researchnester.com/reports/computer-numerical-control-machine-market/5889</a></li>
      <li>Mordor Intelligence, <em>Machining Centers Market Size, Share &amp; Growth Trends Report</em>, 2024. <a href="https://www.mordorintelligence.com/industry-reports/machining-centers-market" rel="noopener" target="_blank">https://www.mordorintelligence.com/industry-reports/machining-centers-market</a></li>
    </ol>
  </div>

</div><!-- /.qf-article-body -->
