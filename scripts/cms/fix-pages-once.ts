/**
 * 一次性页面改版（数据库为唯一事实源，跑完用 `npm run snapshot` 回同步仓库）：
 * About Us / Contact Us 改版为 friway 式营销分区版式（pg-* 组件，样式见 src/styles/page.css）。
 *
 * 正文整体替换为 pg-page 分区结构，但文案不新编：全部取自站内既有内容 ——
 *  About：原正文三段自我介绍与三条优势、文章库反复出现的工厂事实
 *        （est. 2010 / ISO 9001:2015 / CE / 750+ factories / 40+ countries / 100% laser calibrated）、
 *        页脚五条产品线分类名与链接、联系页 FAQ 里的质保与交期口径；
 *  Contact：原信息卡四件（电话邮箱/地址/免运费/支持）、site.json 工作时间、
 *        原正文两组手风琴共 8 条 FAQ 移入 faq 字段（渲染 + FAQPage 结构化数据同源）。
 * 旧 Elementor 残骸（面包屑/重复标题/死按钮/FluentForm 死表单）随替换一并清除。
 */
import { createRestClient } from './lib/rest';
import { loadEnvFile, requireEnv } from './lib/env';

loadEnvFile();
const rest = createRestClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'));

/** 按 slug 定点改几列：PATCH 语义「只改给的列」，避免 upsert 部分行撞 NOT NULL */
async function patch(table: string, slug: string, cols: Record<string, unknown>): Promise<void> {
    const url = `${requireEnv('SUPABASE_URL')}/rest/v1/${table}?slug=eq.${encodeURIComponent(slug)}`;
    const key = requireEnv('SUPABASE_SECRET_KEY');
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
        },
        body: JSON.stringify(cols),
    });
    if (!res.ok) throw new Error(`${table}/${slug} PATCH 失败 HTTP ${res.status}: ${await res.text()}`);
    console.log(`  ✓ ${table}/${slug}: ${Object.keys(cols).join(', ')}`);
}

const ABOUT_BODY = `
<div class="pg-page">
  <div class="pg-stats">
    <div><b>15+</b><span>Years of CNC manufacturing</span></div>
    <div><b>750+</b><span>Factories served worldwide</span></div>
    <div><b>40+</b><span>Countries exported</span></div>
    <div><b>100%</b><span>Laser-calibrated before shipment</span></div>
  </div>
  <ul class="pg-badges">
    <li>ISO 9001:2015</li>
    <li>CE Certified</li>
    <li>OEM &amp; ODM</li>
    <li>Factory-Direct Pricing</li>
    <li>Turnkey Production Lines</li>
  </ul>

  <section class="pg-section pg-2col">
    <div>
      <p class="pg-eyebrow">Who We Are</p>
      <h2>A True Source Factory, Not Just a Trading Company</h2>
      <p><strong>CENNETIC</strong> is a premier manufacturer and innovator of high-precision CNC machine tools in China. Unlike traditional trading companies, we are a true source factory dedicated to engineering, manufacturing, and delivering top-tier, high-efficiency machining solutions to the global market.</p>
      <p>Backed by state-of-the-art manufacturing facilities and a robust R&amp;D team, we offer a comprehensive product portfolio tailored to your diverse industrial needs. Beyond standalone machines, CENNETIC excels in providing customized, turnkey production line solutions.</p>
      <p>Driven by our commitment to "Agile Response &amp; Rapid Execution," we ensure that you always receive the most suitable, cost-effective solutions with fast lead times and comprehensive global support.</p>
    </div>
    <div>
      <p class="pg-eyebrow">What You Get</p>
      <ul class="pg-checks">
        <li><strong>Turnkey production lines</strong> — our engineering team works closely with you to optimize machining processes, ensuring maximum production efficiency and a rapid ROI.</li>
        <li><strong>Factory-direct &amp; OEM/ODM</strong> — factory-direct pricing and highly flexible OEM/ODM capabilities tailored to your brand.</li>
        <li><strong>Rigorous quality assurance</strong> — every machine is 100% laser calibrated before leaving our facility, guaranteeing micron-level precision.</li>
        <li><strong>Global after-sales</strong> — standard warranty on all machines, lifetime technical support, rapid spare parts delivery and 24/7 online troubleshooting.</li>
      </ul>
    </div>
  </section>

  <section class="pg-section tint">
    <p class="pg-eyebrow">Product Range</p>
    <h2>Five Product Lines, One Responsible Factory</h2>
    <div class="pg-cards">
      <div class="pg-card"><h3><a href="/product-category/machining-centers/">Machining Centers (Milling-Focused)</a></h3><p>Vertical machining centers for drilling, tapping and milling — view models &amp; specifications.</p></div>
      <div class="pg-card"><h3><a href="/product-category/cnc-lathes/">CNC Lathes, Swiss-Type &amp; Automatic Lathes</a></h3><p>Precision turning from standard CNC lathes to Swiss-type and automatic machines.</p></div>
      <div class="pg-card"><h3><a href="/product-category/engraving-edm-wirecut/">Precision Engraving, EDM &amp; Wire Cut Machines</a></h3><p>Engraving, EDM and wire cutting for fine-feature and hard-material work.</p></div>
      <div class="pg-card"><h3><a href="/product-category/consumables-tooling/">Machine Tool Consumables &amp; Tooling</a></h3><p>Consumables and tooling that keep your machines running at specification.</p></div>
      <div class="pg-card"><h3><a href="/product-category/quality-control-inspection/">Quality Control &amp; Inspection Equipment</a></h3><p>Inspection equipment to verify what your machines produce.</p></div>
    </div>
  </section>

  <section class="pg-section pg-2col">
    <div>
      <p class="pg-eyebrow">Quality &amp; Compliance</p>
      <h2>Certified Processes, Calibrated Machines</h2>
      <p>Our manufacturing operations are certified under <strong>ISO 9001:2015</strong>, and our machines comply with <strong>CE</strong> directives for international deployment. Every machine undergoes rigorous multi-step inspections — including 100% laser calibration and ball-bar testing — before leaving our facility in Dalingshan, Dongguan.</p>
      <p>Standard CNC lathes and milling machines typically ship in <strong>30–45 days</strong>; customized equipment and complete turnkey production lines are scheduled up front (60–90 days depending on complexity).</p>
    </div>
    <div>
      <p class="pg-eyebrow">At a Glance</p>
      <ul class="pg-badges">
        <li>ISO 9001:2015</li>
        <li>CE</li>
        <li>Ball-bar tested</li>
        <li>Micron-level accuracy</li>
        <li>30–45 days standard lead time</li>
      </ul>
    </div>
  </section>

  <section class="pg-cta">
    <div>
      <h2>Ready to Work With a Real Factory?</h2>
      <p>Send us your part drawings, materials and tolerance requirements — we will recommend a configuration based on 15 years of factory experience.</p>
    </div>
    <div class="pg-cta-actions">
      <a class="btn btn-wa" href="https://wa.me/8615118243737?text=Hi%20Cennetic%2C%20I%27d%20like%20a%20quote%20for%20a%20CNC%20machine." rel="noopener noreferrer" target="_blank">Get a Quick Quote</a>
      <a class="btn btn-ghost" href="/contact-us/">Send an Inquiry</a>
    </div>
  </section>
</div>
`;

const CONTACT_BODY = `
<div class="pg-page">
  <div class="pg-stats">
    <div><b>&le; 1 day</b><span>Sales &amp; engineering reply</span></div>
    <div><b>24/7</b><span>Online troubleshooting</span></div>
    <div><b>15+</b><span>Years of manufacturing</span></div>
    <div><b>750+</b><span>Factories served</span></div>
  </div>

  <section class="pg-section">
    <p class="pg-eyebrow">Contact Channels</p>
    <h2>Reach the Factory Directly</h2>
    <div class="pg-cards">
      <div class="pg-card"><h3>Phone &amp; Email</h3><p><strong>Phone:</strong> +86 1511824 3737<br><strong>Email:</strong> <a href="mailto:bella@cennetic.com">bella@cennetic.com</a></p></div>
      <div class="pg-card"><h3>Factory Address</h3><p>Yueshan Road, Dalingshan, Dongguan, Guangdong, China</p></div>
      <div class="pg-card"><h3>Shipping</h3><p>Free standard shipping on all orders.</p></div>
      <div class="pg-card"><h3>Working Hours</h3><p>Mon–Sat 9:00–18:00 (GMT+8)<br>24/7 online troubleshooting for machines in service.</p></div>
    </div>
    <p class="pg-note">Do you have questions about how we can help your business? <a href="mailto:bella@cennetic.com">Send us an email</a> and we'll get in touch shortly — or use the inquiry form above and we'll reply within one working day.</p>
  </section>
</div>
`;

/** 原正文两组手风琴的 8 条问答，移入 faq 字段：渲染与 FAQPage 结构化数据同源 */
const CONTACT_FAQ = [
    {
        q: 'Are you a trading company or a direct manufacturer?',
        a: 'We are a true source factory located in Dongguan, China. Unlike trading companies, we handle everything from R&D and engineering to manufacturing and direct global sales. This ensures you get factory-direct pricing and strict quality control.',
    },
    {
        q: 'How do you ensure the precision and quality of your CNC machines?',
        a: 'Quality is our priority. Every machine undergoes rigorous multi-step inspections, including 100% laser calibration and ball-bar testing before leaving our facility. We use premium cast iron beds and top-tier components to guarantee micron-level accuracy.',
    },
    {
        q: 'What is the standard lead time for your equipment?',
        a: 'For our standard CNC lathes and milling machines, the lead time is typically 30-45 days. For customized equipment or complete turnkey production line solutions, it may take 60-90 days depending on the complexity of your requirements.',
    },
    {
        q: 'What control systems are available on your machines?',
        a: 'We offer highly flexible configurations. Depending on your machining needs and operator familiarity, we can equip our machines with internationally recognized systems like FANUC, Siemens, Mitsubishi, or high-quality brands like SYNTEC and LNC.',
    },
    {
        q: 'Do you offer OEM/ODM services or customized solutions?',
        a: 'Yes, absolutely. Our experienced engineering team can customize machine specifications, dimensions, and tooling setups to meet your specific manufacturing processes. We excel in providing tailored solutions for various industries.',
    },
    {
        q: 'What kind of after-sales support and warranty do you provide?',
        a: 'We offer a standard 12-month warranty on all our machines. Beyond that, we provide lifetime technical support, rapid spare parts delivery, and 24/7 online troubleshooting to ensure your production never stops.',
    },
    {
        q: 'Can you provide installation and training services for overseas buyers?',
        a: 'Yes. We provide detailed English manuals and video tutorials for standard setups. Upon request, we can also dispatch our technical engineers to your facility for on-site installation, commissioning, and comprehensive operator training.',
    },
    {
        q: 'What are your payment terms for international orders?',
        a: 'Our standard payment terms are 30% T/T as a deposit upon order confirmation, and the remaining 70% T/T balance before shipment after you have inspected the machine (via video call or on-site visit). We also accept L/C at sight for larger orders.',
    },
];

async function main(): Promise<void> {
    const before = await rest.list<{ slug: string; body: string }>(
        'pages',
        'select=slug,body&slug=in.(about-us,contact-us)',
    );
    for (const row of before) {
        if (row.body.includes('class="pg-page"')) {
            console.log(`  · pages/${row.slug}: 已是 pg-page 结构，跳过（幂等）`);
        }
    }

    await patch('pages', 'about-us', {
        heading: 'Empowering Manufacturing with High-Precision CNC Solutions',
        description:
            'CENNETIC is a true source factory for high-precision CNC machine tools in Dongguan, China — factory-direct pricing, OEM/ODM capability and turnkey production lines for buyers worldwide.',
        body: ABOUT_BODY,
    });

    await patch('pages', 'contact-us', {
        heading: 'Talk to Our Factory Team',
        body: CONTACT_BODY,
        faq: CONTACT_FAQ,
    });

    console.log('✓ 两页改版完成：about-us / contact-us → pg-page 分区结构');
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
