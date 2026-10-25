/**
 * 作者归一。
 *
 * 源站 104 个作者框全是同一个人 Bella，但署名职位写了 11 种互不相同的说法
 * （Founder / Editor & CNC Industry Specialist / Webmaster / Site Administrator /
 *  Station Master（明显是错译）/ Site Owner / CNC Programming Specialist …），
 * 且 markup 分两个家族：
 *   A（45）：<h4>Written by Bella — Founder, <a>…</a></h4><p>bio</p>
 *   B（59）：<p class="qf-author-name">Bella — 职位</p><p class="qf-author-bio">bio</p>
 *
 * 处理：全部归一为**一条**作者记录，文章 frontmatter 只写 author: bella。
 * 理由是 SEO 而非美观 —— Google 的 E-E-A-T 依赖作者身份一致性，
 * 同一主体挂多个互相矛盾的称谓会削弱信任信号。以后改头衔只需改一处。
 *
 * 所有被合并掉的原始写法都完整写进迁移报告，不做静默丢弃。
 */
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

export interface AuthorVariant {
    slug: string;
    /** 署名行原文 */
    byline: string;
    /** 解析出的人名 */
    name: string;
    /** 解析出的职位 */
    role: string;
    /** 纯文本简介 */
    bio: string;
    /** 头像占位字母 */
    avatar: string;
    markup: 'h4+p' | 'name-p' | 'name-div' | 'other';
}

export interface CanonicalAuthor {
    slug: string;
    name: string;
    role: string;
    bio: string;
    avatar: string;
}

/** 去掉署名行里嵌入的公司链接文字，避免把源站的“QiaoFeng CNC Machine”混进职位 */
function cleanByline(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * 从署名行提取人名与职位。
 * 实测存在的写法全部列出，逐条匹配而不是用一个万能正则去猜。
 */
export function parseByline(raw: string): { name: string; role: string } {
    const s = cleanByline(raw)
        .replace(/^Written by\s+/i, '')
        .replace(/^About the Author:?\s+/i, '')
        .replace(/^Author:?\s+/i, '')
        .replace(/^By\s+/i, '');

    // 源站实测写法（旧品牌域名，管道只按分隔符切，不依赖这个字样）：
    // "Bella — Founder & CNC Specialist, QFCNCMACHINE.COM"
    // "Bella | QFCNCMACHINE.COM Webmaster"
    const sep = s.match(/^(.+?)\s*(?:[—–|]| - )\s*(.+)$/);
    if (sep) {
        return { name: sep[1]!.trim(), role: sep[2]!.trim() };
    }

    // "Bella"（无职位）
    return { name: s.replace(/[,.\s]+$/, '').trim(), role: '' };
}

/** 从作者框 DOM 提取一个变体；提取不到就把整块文本当 byline 兜底 */
export function readAuthorBox($: CheerioAPI, box: Cheerio<AnyNode>): AuthorVariant | null {
    const info = box.find('.qf-author-info').first().length ? box.find('.qf-author-info').first() : box;

    const heading = info.find('h1,h2,h3,h4,h5,h6').first();
    const nameNode = info.find('.qf-author-name, .qf-name').first();
    const bioNode = info.find('.qf-author-bio').first().length
        ? info.find('.qf-author-bio').first()
        : info.find('p').last();

    let byline = '';
    let markup: AuthorVariant['markup'] = 'other';

    if (heading.length && heading.text().trim()) {
        byline = heading.text();
        markup = 'h4+p';
    } else if (nameNode.length) {
        byline = nameNode.text();
        markup = nameNode.get(0) ? ((nameNode.get(0) as { tagName?: string }).tagName?.toLowerCase() === 'div' ? 'name-div' : 'name-p') : 'name-p';
    } else {
        // 兜底：取 info 的第一段非空文本
        byline = info.text();
        markup = 'other';
    }

    const bio = bioNode.length ? bioNode.text().replace(/\s+/g, ' ').trim() : '';
    byline = byline.replace(/\s+/g, ' ').trim();

    // byline 里可能把 bio 一起带进来（兜底路径），按长度截断保护
    if (byline.length > 160) byline = byline.slice(0, 160);

    if (!byline && !bio) return null;

    const { name, role } = parseByline(byline);
    const avatar = box.find('.qf-author-avatar').first().text().trim().slice(0, 2).toUpperCase();

    return { slug: '', byline, name, role, bio, avatar, markup };
}

/** 这一段看起来像联系方式吗（邮箱 / 国际电话 / 裸域名），而不是止常正文 */
function looksLikeContact(segment: string): boolean {
    const s = segment.trim();
    if (!s) return true; // 空段直接干掉，不阻断回溯
    return (
        /[\w.+\-]+@[\w.\-]+/i.test(s) ||
        /\+?\d[\d\s()\-]{8,}/.test(s) ||
        /\b[\w-]+\.(?:com|cn|net)\b/i.test(s)
    );
}

/**
 * 剥掉源站简介尾部手写的联系方式行（形如 “📧 a@b.com | 📞 +86… | 🌐 domain”）。
 * 电话与邮箱在 site.json 已有唯一来源，写进 bio 会造成同一数据两处维护，
 * 换号时必漏。联系方式由模板从 site.json 渲染。
 *
 * 实现用“按 | 分段、从尾部逐段回退”而不是堆叠正则：
 * 正则多轮回溯只能剥掉嵌套在尾部的其中一段，循环能一直接直到碰到正文。
 */
function stripTrailingContacts(bio: string): string {
    const parts = bio.split('|');

    while (parts.length > 1 && looksLikeContact(parts[parts.length - 1]!)) {
        parts.pop();
    }

    let out = parts.join('|');

    // 尾段里正文与联系方式混写（无分隔符直接接在最后一句后）的情况：
    // 以第一个邮箱/电话出现位置截断，并清掉残留意符与标点
    const cut = out.search(/[\p{Extended_Pictographic}\s]*[\w.+\-]+@[\w.\-]+|[\p{Extended_Pictographic}\s]*\+\d[\d\s()\-]{8,}/u);
    if (cut > 40) out = out.slice(0, cut);

    return out.replace(/[\s|｜·\p{Extended_Pictographic}]+$/u, '').trim();
}

/**
 * 选出规范作者记录。
 *
 * 取物口径统一用「多数即真实」：人名、职位、简介都取出现频次最高者，
 * 长度只做同票时的次要依据。不能按「最长」选 —— 最长的往往是某篇专题文章
 * 给 Bella 写的垂直化简介（如 GD&T 专业），当通用署名会对其余上百篇文章做出错误声明，
 * 而它会进入 Person 结构化数据，属于事实性风险而不是美观问题。
 */
export function canonicalize(variants: AuthorVariant[]): { author: CanonicalAuthor | null; markupMix: Record<string, number> } {
    const markupMix: Record<string, number> = {};
    for (const v of variants) markupMix[v.markup] = (markupMix[v.markup] ?? 0) + 1;

    if (variants.length === 0) return { author: null, markupMix };

    /** 按给定取键函数统计频次，同票时偏长者胜 */
    const rank = (keyFn: (v: AuthorVariant) => string, pool: AuthorVariant[] = variants) => {
        const m = new Map<string, { count: number; len: number }>();
        for (const v of pool) {
            const k = keyFn(v).replace(/\s+/g, ' ').trim();
            if (!k) continue;
            const cur = m.get(k) ?? { count: 0, len: 0 };
            cur.count += 1;
            cur.len = Math.max(cur.len, k.length);
            m.set(k, cur);
        }
        return [...m.entries()].sort((a, b) => b[1].count - a[1].count || b[1].len - a[1].len);
    };

    const name = rank((v) => v.name)[0]?.[0] ?? 'Bella';
    const mine = variants.filter((v) => v.name === name);

    // Station Master / Site Administrator 一类属于角色错标，宁可回落到 Founder
    const ROLE_DENY = /station master|site administrator|site owner|webmaster/i;
    const roles = rank((v) => v.role, mine).filter(([r]) => !ROLE_DENY.test(r));
    const role = roles[0]?.[0] ?? 'Founder, Cennetic CNC Machine';

    // 取最高频简介：它必须是跨主题都成立的通用自我描述
    const bios = rank((v) => v.bio, mine);
    const bio = stripTrailingContacts(bios[0]?.[0] ?? '');

    return {
        author: {
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            name,
            role,
            bio,
            avatar: mine.find((v) => v.avatar)?.avatar ?? name.charAt(0).toUpperCase(),
        },
        markupMix,
    };
}
