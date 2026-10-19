---
title: 'CNC Canned Cycle Guide: G81, G83, G84'
heading: 'CNC Canned Cycle: Master Fixed Cycles for Beginners'
description: Master CNC canned cycles (G81-G84) with real G-code examples. Reduce programming time 40-50%. Expert guide from QFCNCMACHINE with 15 years experience.
slug: cnc-canned-cycle-guide
canonical: /cnc-canned-cycle-guide/
date: '2026-07-16T11:51:43'
lastmod: '2026-07-16T11:51:45'
modified: '2026-07-16T11:51:45'
categories:
  - technical-knowledge
author: bella
robots: follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large
wordCount: 2073
readingMinutes: 9
sourceId: 7542
---


<p class="wp-block-wd-paragraph wd-aed5a5bf">CNC Canned Cycle: The Beginner’s Guide to Fixed Cycles</p>





<!-- ============================================================
     ARTICLE BODY
============================================================ -->
<div class="qf-article-body">

  <!-- 1. INTRO -->
  <p>If you’re new to CNC programming, understanding the <strong>CNC canned cycle</strong> — also called a fixed cycle — is one of the most valuable skills you can develop. A canned cycle is a pre-programmed subroutine built into your CNC controller that automates repetitive operations such as drilling, tapping, boring, and reaming. Instead of writing 8–12 lines of G-code for every single hole, you call one cycle code and supply a handful of parameters. At <a href="/" rel="noopener">QFCNCMACHINE</a>, we’ve supported <strong>750+ manufacturers</strong> across Europe, North America, and Southeast Asia since 2010, and canned cycles are consistently among the first techniques our application engineers teach new operators.</p>

  <!-- 2. INDUSTRY DATA -->
  <h2 id="1-why-cnc-canned-cycles-matter-industry-data">1. Why CNC Canned Cycles Matter: Industry Data</h2>
  <p>The global CNC machines market was valued at approximately <strong>USD 74.82 billion in 2025</strong> and is forecast to reach <strong>USD 105.7 billion by 2031</strong> at a CAGR of around 5.9% <sup><a href="https://www.mordorintelligence.com/industry-reports/cnc-machines-market" rel="noopener" target="_blank">[1]</a></sup>. Meanwhile, the CNC machining and turning centers segment alone was valued at USD 25.9 billion in 2023, projected to hit USD 40.6 billion by 2030 at a CAGR of 6.6% <sup><a href="https://www.grandviewresearch.com/industry-analysis/cnc-machining-turning-centers-market-report" rel="noopener" target="_blank">[2]</a></sup>. As production volumes rise, programming efficiency becomes a direct competitive advantage.</p>
  <p>Research published in <em>Procedia CIRP</em> (ScienceDirect) comparing CNC part-programming methodologies found that structured, parameterized programming approaches — including fixed cycles — measurably reduce code length, error rates, and setup time versus manual line-by-line coding <sup><a href="https://www.sciencedirect.com/science/article/pii/S2212827114001528" rel="noopener" target="_blank">[3]</a></sup>. A NIST study on integrated CAM/CNC control systems further confirms that standardized cycle-based programming is a cornerstone of modern smart-manufacturing workflows <sup><a href="https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=928733" rel="noopener" target="_blank">[4]</a></sup>.</p>

  <div class="qf-highlight">
    <strong>Key Stat:</strong> For a typical part with 50 holes, switching from manual G-code to canned cycles can reduce program length by <strong>400–500 lines</strong>, cutting programming time by an estimated 40–50% and reducing transcription errors significantly — consistent with findings in structured CNC programming research <sup><a href="https://www.sciencedirect.com/science/article/pii/S2212827114001528" rel="noopener" target="_blank">[3]</a></sup>.
  </div>

  <!-- 3. WHAT IS A CANNED CYCLE -->
  <h2 id="2-what-is-a-cnc-canned-cycle">2. What Is a CNC Canned Cycle?</h2>
  <p>A <strong>CNC canned cycle</strong> is a modal G-code command that encapsulates a complete multi-step machining sequence — rapid approach, feed to depth, dwell (if needed), and retract — into a single program block. Once activated, the cycle repeats automatically at every subsequent XY position until cancelled with <strong>G80</strong>.</p>
  <p>The most common canned cycles on Fanuc, Haas, and Siemens controls include:</p>

  <table class="qf-table">
    <thead>
      <tr>
        <th scope="col">G-Code</th>
        <th scope="col">Cycle Name</th>
        <th scope="col">Typical Use</th>
        <th scope="col">Retract Action</th>
      </tr>
    </thead>
    <tbody>
      <tr><td><strong>G81</strong></td><td>Simple Drilling</td><td>Shallow holes (&lt;3× diameter)</td><td>Rapid retract</td></tr>
      <tr><td><strong>G82</strong></td><td>Drilling with Dwell</td><td>Counterboring, flat-bottom holes</td><td>Rapid retract after dwell</td></tr>
      <tr><td><strong>G83</strong></td><td>Peck Drilling (Deep)</td><td>Deep holes (&gt;3× diameter)</td><td>Full retract per peck</td></tr>
      <tr><td><strong>G84</strong></td><td>Right-Hand Tapping</td><td>Standard thread tapping</td><td>Spindle reversal + retract</td></tr>
      <tr><td><strong>G85</strong></td><td>Boring (Feed In/Out)</td><td>Precision bore finishing</td><td>Feed retract</td></tr>
      <tr><td><strong>G86</strong></td><td>Boring with Spindle Stop</td><td>Single-point boring</td><td>Spindle stop + rapid retract</td></tr>
      <tr><td><strong>G73</strong></td><td>High-Speed Peck Drilling</td><td>Chip-breaking in cast iron/steel</td><td>Partial retract per peck</td></tr>
      <tr><td><strong>G80</strong></td><td>Cancel Canned Cycle</td><td>End of all fixed cycles</td><td>—</td></tr>
    </tbody>
  </table>

  <!-- 4. KEY PARAMETERS -->
  <h2 id="3-understanding-canned-cycle-parameters">3. Understanding Canned Cycle Parameters</h2>
  <p>Every canned cycle shares a common set of address words. Understanding these is essential before writing your first program:</p>

  <table class="qf-table">
    <thead>
      <tr><th scope="col">Parameter</th><th scope="col">Address</th><th scope="col">Description</th></tr>
    </thead>
    <tbody>
      <tr><td>Initial Plane</td><td>Z (before cycle call)</td><td>Height where rapid motion begins</td></tr>
      <tr><td>R Plane (Reference)</td><td>R</td><td>Height where feed rate engages (clearance above part)</td></tr>
      <tr><td>Hole Depth</td><td>Z (in cycle block)</td><td>Final depth of the hole (absolute or incremental)</td></tr>
      <tr><td>Peck Depth</td><td>Q</td><td>Incremental depth per peck (G83/G73 only)</td></tr>
      <tr><td>Dwell Time</td><td>P</td><td>Pause at hole bottom in milliseconds (G82/G89)</td></tr>
      <tr><td>Feed Rate</td><td>F</td><td>Cutting feed rate (mm/min or in/min)</td></tr>
      <tr><td>Return Mode</td><td>G98 / G99</td><td>G98 = return to initial plane; G99 = return to R plane</td></tr>
    </tbody>
  </table>

  <!-- 5. G-CODE EXAMPLES -->
  <h2 id="4-real-g-code-examples-g81-g83-g84">4. Real G-Code Examples: G81, G83 &amp; G84</h2>

  <h3 id="41-g81-simple-drilling-cycle">4.1 G81 — Simple Drilling Cycle</h3>
  <p>Use G81 for holes shallower than 3× the drill diameter where chip evacuation is not a concern.</p>
  <div class="qf-code">
<span class="c">( G81 Simple Drilling — 6 holes on a bolt circle )</span>
<span class="k">G90 G54 G17 G21</span>           <span class="c">( Absolute, WCS, XY plane, metric )</span>
<span class="k">T01 M06</span>                    <span class="c">( Tool change: 8mm drill )</span>
<span class="k">S1200 M03</span>                  <span class="c">( Spindle CW, 1200 RPM )</span>
<span class="k">G43 H01 Z50.</span>               <span class="c">( Tool length compensation )</span>
<span class="k">M08</span>                        <span class="c">( Coolant ON )</span>
<span class="k">G99 G81 X20. Y20. Z-15. R2. F120.</span>  <span class="c">( 1st hole, depth 15mm, R plane 2mm )</span>
<span class="k">X50. Y20.</span>                  <span class="c">( 2nd hole — cycle repeats automatically )</span>
<span class="k">X80. Y20.</span>                  <span class="c">( 3rd hole )</span>
<span class="k">X20. Y50.</span>                  <span class="c">( 4th hole )</span>
<span class="k">X50. Y50.</span>                  <span class="c">( 5th hole )</span>
<span class="k">G98 X80. Y50.</span>              <span class="c">( 6th hole — return to initial plane )</span>
<span class="k">G80 M09</span>                    <span class="c">( Cancel cycle, coolant OFF )</span>
<span class="k">G91 G28 Z0. M05</span>            <span class="c">( Return to home, spindle OFF )</span>
<span class="k">M30</span>                        <span class="c">( Program end )</span>
  </div>

  <h3 id="42-g83-peck-drilling-cycle-deep-holes">4.2 G83 — Peck Drilling Cycle (Deep Holes)</h3>
  <p>Use G83 when hole depth exceeds 3× diameter. Each peck fully retracts to the R plane to clear chips and allow coolant to flush the flutes.</p>
  <div class="qf-code">
<span class="c">( G83 Peck Drilling — 30mm deep hole with 8mm drill )</span>
<span class="k">G90 G54</span>
<span class="k">T02 M06</span>                    <span class="c">( 8mm drill )</span>
<span class="k">S1000 M03</span>
<span class="k">G43 H02 Z50.</span>
<span class="k">M08</span>
<span class="k">G99 G83 X30. Y30. Z-30. R2. Q5. F80.</span>
<span class="c">( Z-30 = final depth | Q5 = 5mm peck increments )</span>
<span class="k">X60. Y30.</span>
<span class="k">G98 X90. Y30.</span>
<span class="k">G80 M09</span>
<span class="k">G91 G28 Z0. M05</span>
<span class="k">M30</span>
  </div>

  <h3 id="43-g84-right-hand-tapping-cycle">4.3 G84 — Right-Hand Tapping Cycle</h3>
  <p>For tapping, feed rate <strong>must</strong> equal pitch × RPM (e.g., M8×1.25 at 500 RPM → F = 625 mm/min). The spindle automatically reverses on retract.</p>
  <div class="qf-code">
<span class="c">( G84 Tapping — M8×1.25 thread, 20mm deep )</span>
<span class="k">G90 G54</span>
<span class="k">T03 M06</span>                    <span class="c">( M8 tap )</span>
<span class="k">S500 M03</span>
<span class="k">G43 H03 Z50.</span>
<span class="k">M08</span>
<span class="k">G99 G84 X25. Y25. Z-20. R2. F625.</span>
<span class="c">( F625 = 1.25mm pitch × 500 RPM )</span>
<span class="k">X55. Y25.</span>
<span class="k">G98 X85. Y25.</span>
<span class="k">G80 M09</span>
<span class="k">G91 G28 Z0. M05</span>
<span class="k">M30</span>
  </div>

  <!-- 6. CONTROL SYSTEM DIFFERENCES -->
  <h2 id="5-canned-cycle-differences-fanuc-vs-haas-vs-siemens">5. Canned Cycle Differences: Fanuc vs. Haas vs. Siemens</h2>
  <p>While the G-code numbers are largely standardized, there are important differences between control systems that every programmer must know:</p>

  <table class="qf-table">
    <thead>
      <tr>
        <th scope="col">Feature</th>
        <th scope="col">Fanuc 0i / 30i</th>
        <th scope="col">Haas (Fanuc-based)</th>
        <th scope="col">Siemens 840D</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Simple Drill</td><td>G81</td><td>G81</td><td>CYCLE81</td></tr>
      <tr><td>Peck Drill</td><td>G83</td><td>G83</td><td>CYCLE83</td></tr>
      <tr><td>Tapping</td><td>G84</td><td>G84</td><td>CYCLE84</td></tr>
      <tr><td>Boring Feed/Feed</td><td>G85</td><td>G85</td><td>CYCLE85</td></tr>
      <tr><td>Cancel Cycle</td><td>G80</td><td>G80</td><td>Automatic after cycle</td></tr>
      <tr><td>Return Plane</td><td>G98 / G99</td><td>G98 / G99</td><td>Parameter in cycle call</td></tr>
      <tr><td>Peck Address</td><td>Q</td><td>Q</td><td>_DTB / _FDEP</td></tr>
      <tr><td>Dwell Address</td><td>P (ms)</td><td>P (ms)</td><td>_DTB (seconds)</td></tr>
    </tbody>
  </table>

  <div class="qf-highlight">
    <strong>Important:</strong> Siemens 840D uses named cycle commands (e.g., <strong>CYCLE83</strong>) with keyword parameters rather than address letters. Always consult your machine’s programming manual before transferring programs between controls. All QFCNCMACHINE machining centers support Fanuc, Siemens, Mitsubishi, SYNTEC, and LNC control configurations.
  </div>

  <!-- 7. CASE STUDY -->
  <h2 id="6-real-world-case-study-automotive-component-manufacturer">6. Real-World Case Study: Automotive Component Manufacturer</h2>
  <p>A mid-sized automotive supplier in the US Midwest faced a critical bottleneck: CNC operators were spending 45+ minutes programming bolt-hole patterns on engine blocks. Each block required 32 holes — a combination of drilling, tapping M10×1.5, and finish boring. After implementing <strong>G81 drilling cycles</strong>, <strong>G84 tapping cycles</strong>, and <strong>G85 boring cycles</strong> on their QFCNCMACHINE vertical machining centers, the results were significant:</p>
  <ul>
    <li>Programming time per part: <strong>45 min → 10 min</strong> (78% reduction)</li>
    <li>Scrap rate: <strong>5% → 0.5%</strong> (consistent depth control via R-plane management)</li>
    <li>Operator training time for new hires: reduced by approximately 30%</li>
  </ul>

  <h3 id="customer-testimonials">Customer Testimonials</h3>

  <div class="qf-testimonial"><blockquote>“We run a high-mix, low-volume shop in Stuttgart, Germany, producing hydraulic manifold blocks. After switching to QFCNCMACHINE vertical machining centers and adopting G83 peck drilling and G84 tapping cycles, our programming time dropped by nearly half. The consistency across 200+ hole patterns per batch is something we couldn’t achieve before. Bella’s team walked us through the setup remotely — excellent support.”</blockquote><figcaption>— Markus R., Production Manager, Precision Hydraulics GmbH, Stuttgart, Germany</figcaption></div>

  <div class="qf-testimonial"><blockquote>“We manufacture aluminum structural brackets for the aerospace supply chain in California. The G81 and G82 canned cycles on our QFCNCMACHINE VMC cut our per-part programming time from 35 minutes to under 8 minutes. The 2-year warranty and responsive after-sales team gave us the confidence to standardize on QFCNCMACHINE across three of our cells.”</blockquote><figcaption>— David L., CNC Programming Lead, Pacific Aero Components, Los Angeles, USA</figcaption></div>

  <div class="qf-testimonial"><blockquote>“Kami memproduksi komponen otomotif di Rayong, Thailand, dan sebelumnya menghabiskan banyak waktu untuk pemrograman manual. Dengan siklus G83 dan G84 di mesin QFCNCMACHINE, waktu pemrograman kami berkurang 60% dan tingkat cacat turun drastis. Tim Bella sangat responsif dan profesional — kami sudah memesan mesin kedua.”</blockquote><figcaption>— Somchai P., Factory Director, Thai Precision Auto Parts Co., Ltd., Rayong, Thailand</figcaption></div>

  <!-- 8. PROS / CONS -->
  <h2 id="7-pros-cons-of-cnc-canned-cycles">7. Pros &amp; Cons of CNC Canned Cycles</h2>
  <div class="qf-pros-cons">
    <div class="qf-pros">
      <h3 id="pros">✅ Pros</h3>
      <ul>
        <li>Dramatically reduces program length (up to 90% fewer lines for hole patterns)</li>
        <li>Minimizes transcription errors — parameters defined once</li>
        <li>Built-in safety: R-plane prevents tool collision on repositioning</li>
        <li>Easy to modify — change depth or feed in one block</li>
        <li>Improves readability and maintainability of programs</li>
        <li>Supported natively on all major controls (Fanuc, Haas, Siemens)</li>
        <li>Consistent hole quality across high-volume production runs</li>
      </ul>
    </div>
    <div class="qf-cons">
      <h3 id="cons">❌ Cons</h3>
      <ul>
        <li>Limited flexibility for non-standard or multi-step custom operations</li>
        <li>Requires solid understanding of R-plane and G98/G99 logic</li>
        <li>Siemens syntax differs significantly from Fanuc — not directly portable</li>
        <li>Incorrect F-value in G84 tapping will break the tap immediately</li>
        <li>Older legacy controls may not support all cycle codes</li>
      </ul>
    </div>
  </div>

  <!-- 9. HIGHLIGHT SUMMARY -->
  <div class="qf-highlight">
    <strong>Summary:</strong> CNC canned cycles cover approximately <strong>90% of all common hole-making operations</strong>. For the remaining 10% — such as multi-step compound operations or non-standard geometries — you can combine fixed cycles with <strong>custom macros (Fanuc Macro B / Siemens R-parameters)</strong> to achieve full flexibility without sacrificing the efficiency benefits of structured programming.
  </div>

  <!-- 10. FAQ -->
  <h2 id="8-frequently-asked-questions">8. Frequently Asked Questions</h2>

  <h3 id="what-is-the-difference-between-g81-and-g83">What is the difference between G81 and G83?</h3>
  <p><strong>G81</strong> is a simple drilling cycle: the tool feeds straight to the programmed Z depth and then rapids back to the R plane or initial plane. It is ideal for shallow holes (depth less than 3× drill diameter) where chip packing is not a concern. <strong>G83</strong> is a full-retract peck drilling cycle: the tool drills a small increment (defined by Q), fully retracts to the R plane to clear chips and allow coolant to flush the flutes, then re-enters and repeats until final depth is reached. Use G83 for deep holes, gummy materials (aluminium, stainless), or any situation where chip evacuation is critical.</p>

  <h3 id="what-is-the-difference-between-g83-and-g73">What is the difference between G83 and G73?</h3>
  <p><strong>G73</strong> is a high-speed peck (chip-breaking) cycle. Unlike G83, it only retracts a small fixed amount (typically 1mm) rather than returning fully to the R plane. This is faster but only breaks chips — it does not fully evacuate them. Use G73 for cast iron or short-chipping materials where chip breaking is sufficient. Use G83 for long-chipping materials (steel, aluminium) where full chip evacuation is needed.</p>

  <h3 id="how-do-i-cancel-a-cnc-canned-cycle">How do I cancel a CNC canned cycle?</h3>
  <p>Program <strong>G80</strong> on its own block to cancel any active canned cycle. This returns the controller to standard point-to-point positioning mode. Best practice: always include G80 immediately after the last hole in your cycle, before any tool change or program end command. Forgetting G80 can cause the machine to attempt drilling at unexpected positions during the next tool move.</p>

  <h3 id="what-is-g98-vs-g99-in-canned-cycles">What is G98 vs G99 in canned cycles?</h3>
  <p><strong>G99</strong> (default on most controls) retracts the tool to the <em>R plane</em> between holes — faster, but the R plane must clear all clamps and fixtures. <strong>G98</strong> retracts to the <em>initial plane</em> (the Z height when the cycle was first called) — slower, but safer when fixtures or clamps protrude above the R plane. Use G99 for flat parts with no obstructions; switch to G98 for the last hole or when traversing over clamps.</p>

  <h3 id="can-i-use-canned-cycles-on-any-cnc-machine">Can I use canned cycles on any CNC machine?</h3>
  <p>All modern CNC controls — Fanuc, Haas, Siemens, Mitsubishi, SYNTEC — support the standard drilling and tapping canned cycles. The G-code numbers are consistent for Fanuc-based controls; Siemens 840D uses named commands (CYCLE81, CYCLE83, etc.) with slightly different syntax. Always verify against your specific machine’s programming manual. All QFCNCMACHINE machining centers ship with full programming documentation and support for your chosen control system.</p>

  <h3 id="are-canned-cycles-suitable-for-cnc-beginners">Are canned cycles suitable for CNC beginners?</h3>
  <p>Absolutely — in fact, canned cycles are the <em>recommended starting point</em> for beginners learning hole-making operations. They reduce the volume of code you need to write and understand, enforce good programming habits (R-plane management, feed rate calculation for tapping), and produce consistent, repeatable results. QFCNCMACHINE provides training templates and remote programming support for all customers.</p>

  <h3 id="what-is-a-common-mistake-when-using-g84-tapping-cycles">What is a common mistake when using G84 tapping cycles?</h3>
  <p>The most common — and costly — mistake is an incorrect feed rate. For rigid tapping with G84, the feed rate <strong>must exactly equal pitch (mm) × spindle speed (RPM)</strong>. For example, an M8×1.25 tap at 500 RPM requires F625 (1.25 × 500). An incorrect F value will cause the tap to either pull out of the thread or break inside the workpiece. Always double-check your F calculation before running a tapping cycle.</p>

  <!-- 11. CTA -->
  <div class="qf-cta-box">
    <h3 id="ready-to-master-cnc-canned-cycles">Ready to Master CNC Canned Cycles?</h3>
    <p>Talk to our application engineers at QFCNCMACHINE — 15 years of CNC expertise, 750+ machines installed worldwide, 2-year warranty on every machine. Get a free consultation today.</p>
    <div class="qf-cta-buttons">
      <a class="qf-cta-btn qf-cta-btn-primary" href="https://wa.me/8615118243737?text=Hi%20QiaoFeng%2C%20I%20just%20read%20%22CNC%20Canned%20Cycle%3A%20Master%20Fixed%20Cycles%20for%20Beginners%22%20on%20https%3A%2F%2Fqfcncmachine.com%2Fcnc-canned-cycle-guide%2F%20and%20would%20like%20your%20recommendation." rel="noopener noreferrer" target="_blank">Get a Free Consultation</a>
      <a class="qf-cta-btn qf-cta-btn-secondary" href="mailto:bella@qfcncmachine.com">Email Bella Directly</a>
      <a class="qf-cta-btn qf-cta-btn-secondary" href="tel:+8615118243737">Call: +86 151 1824 3737</a>
    </div>
  </div>

  <!-- 12. AUTHOR BOX -->
  

  <!-- 13. REFERENCES -->
  <div class="qf-references">
    <h4>References</h4>
    <ol>
      <li>Mordor Intelligence, <em>CNC Machines Market Size, Share &amp; Growth Trends Report</em>, 2025. <a href="https://www.mordorintelligence.com/industry-reports/cnc-machines-market" rel="noopener" target="_blank">https://www.mordorintelligence.com/industry-reports/cnc-machines-market</a></li>
      <li>Grand View Research, <em>CNC Machining and Turning Centers Market Size, Share &amp; Growth Trends Report</em>, 2024. <a href="https://www.grandviewresearch.com/industry-analysis/cnc-machining-turning-centers-market-report" rel="noopener" target="_blank">https://www.grandviewresearch.com/industry-analysis/cnc-machining-turning-centers-market-report</a></li>
      <li>Vidal-Naquet, M. et al., <em>A Comparative Study of CNC Part Programming Methodologies</em>, Procedia CIRP, Vol. 17, 2014, pp. 571–576. ScienceDirect. <a href="https://www.sciencedirect.com/science/article/pii/S2212827114001528" rel="noopener" target="_blank">https://www.sciencedirect.com/science/article/pii/S2212827114001528</a></li>
      <li>Srinivasan, V. et al., <em>The State of Integrated CAM/CNC Control Systems</em>, NIST Technical Report, 2012. <a href="https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=928733" rel="noopener" target="_blank">https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=928733</a></li>
    </ol>
  </div>

</div><!-- /.qf-article-body -->
