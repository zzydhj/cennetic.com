/**
 * SEO 数据构造：标题模板、JSON-LD 图。
 *
 * 迁移期原则：**先与源站逐条对齐，再谈优化**。
 * title / description / robots / canonical 一律取内容里从源站搬来的值，
 * 只有源站缺失时才按模板兜底 —— 避免排名波动。
 */
import { siteConfig } from './catalog.ts';

export interface SeoInput {
    /** 页面主标题（不含站点后缀） */
    title: string;
    description: string;
    /** 站内路径，带尾斜杠 */
    path: string;
    robots?: string;
    ogImage?: string;
    ogImageWidth?: number;
    ogImageHeight?: number;
    type?: 'website' | 'article';
    publishedTime?: string;
    modifiedTime?: string;
    authorName?: string;
    /** 面包屑，顺序自根到叶 */
    breadcrumb?: Array<{ name: string; path: string }>;
    /** 页型，决定输出哪种 JSON-LD 主体 */
    pageType?: 'home' | 'article' | 'product' | 'category' | 'archive' | 'page';
    product?: {
        name: string;
        description: string;
        images: string[];
        sku?: string;
        categories?: string[];
    };
    faq?: Array<{ q: string; a: string }>;
}

const ORIGIN = siteConfig.url.replace(/\/$/, '');

/** 站内路径 → 绝对 URL */
export function absoluteUrl(path: string): string {
    if (typeof path !== 'string') {
        // 不静默返回一个错 URL：结构化数据里的错 URL 会直接损害收录，必须响
        throw new Error(`absoluteUrl 收到非字符串路径：${String(path)}`);
    }
    if (path.startsWith('http')) return path;
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${ORIGIN}${p.endsWith('/') ? p : `${p}/`}`;
}

/**
 * 静态文件路径 → 绝对 URL（og:image、JSON-LD 的 ImageObject 用）。
 *
 * 绝不能复用 absoluteUrl：那个按「目录式页面」补尾斜杠，给图片用会产出
 * https://…/10003.webp/ 这种 404 地址（Pages 把带斜杠的当目录）。分享图
 * 拿不到就等于该页在 WhatsApp / Facebook / LinkedIn 上没有卡片，且不会报错，
 * 只能靠产物闸拦（npm run verify:site 会校验 og:image 指向的文件确实在 dist 里）。
 */
export function assetUrl(path?: string): string | undefined {
    if (!path) return undefined;
    if (/^https?:\/\//.test(path)) return path;
    return `${ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * <title> 拼接。首页只用品牌名，其余用「页面 - 品牌」。
 * 与源站 Rank Math 的 %title% %sep% %sitename% 规则一致。
 */
export function formatTitle(title: string, isHome = false): string {
    if (isHome) return `${siteConfig.name} | CNC Manufacturer In China`;
    if (title.includes(siteConfig.name)) return title;
    return `${title} - ${siteConfig.name}`;
}

/** schema.org Organization —— 全站每页都输出，是 E-E-A-T 的锚点 */
export function organizationNode() {
    return {
        '@type': 'Organization',
        '@id': `${ORIGIN}/#organization`,
        name: siteConfig.legalName,
        alternateName: siteConfig.name,
        url: `${ORIGIN}/`,
        email: siteConfig.email,
        telephone: siteConfig.phone,
        description: siteConfig.description,
        address: {
            '@type': 'PostalAddress',
            streetAddress: siteConfig.address.street,
            addressLocality: siteConfig.address.city,
            addressRegion: siteConfig.address.region,
            addressCountry: siteConfig.address.countryCode,
        },
        contactPoint: [
            {
                '@type': 'ContactPoint',
                contactType: 'sales',
                telephone: siteConfig.phone,
                email: siteConfig.email,
                availableLanguage: ['en', 'zh'],
                areaServed: 'Worldwide',
            },
        ],
        sameAs: [`https://wa.me/${siteConfig.whatsapp.number}`],
    };
}

/** WebSite 节点；不提供 SearchAction —— 站内搜索随纯静态化下线 */
export function websiteNode() {
    return {
        '@type': 'WebSite',
        '@id': `${ORIGIN}/#website`,
        url: `${ORIGIN}/`,
        name: siteConfig.name,
        description: siteConfig.description,
        publisher: { '@id': `${ORIGIN}/#organization` },
        inLanguage: siteConfig.language,
    };
}

/** Person 节点，文章页引用它，与 author.url 指向同一身份 */
export function personNode(name: string, role: string, url: string) {
    return {
        '@type': 'Person',
        '@id': `${url}#person`,
        name,
        jobTitle: role,
        url,
    };
}

export function breadcrumbNode(items: Array<{ name: string; path: string }>) {
    // 丢掉无路径的项（常见于末级当前页），否则会渲染出指回站点根的无效链接
    const usable = items.filter((it) => typeof it.path === 'string' && it.path.startsWith('/'));
    return {
        '@type': 'BreadcrumbList',
        '@id': `${ORIGIN}${usable.at(-1)?.path ?? '/'}`, // 与下面 itemList 同源于过滤后的列表
        itemListElement: usable.map((it, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: it.name,
            item: absoluteUrl(it.path),
        })),
    };
}

export function imageNode(url: string, caption: string, width?: number, height?: number) {
    return {
        '@type': 'ImageObject',
        url,
        caption,
        ...(width && height ? { width, height } : {}),
    };
}

/**
 * 组装整站 JSON-LD @graph。
 * 用 @graph + @id 互引而不是多个独立 script，
 * 既让 Google 把组织/站点/页面识别成同一主体的关联信号，也只占一个脚本块。
 */
export function buildJsonLd(input: SeoInput): Record<string, unknown> {
    const url = absoluteUrl(input.path);
    const graph: unknown[] = [organizationNode()];

    if (input.pageType === 'home' || input.pageType === 'archive') graph.push(websiteNode());

    const page: Record<string, unknown> = {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: input.title,
        description: input.description,
        isPartOf: { '@id': `${ORIGIN}/#website` },
        publisher: { '@id': `${ORIGIN}/#organization` },
        inLanguage: siteConfig.language,
    };
    if (input.ogImage) page.primaryImageOfPage = { '@id': `${url}#image` };
    graph.push(page);

    if (input.breadcrumb?.length) graph.push(breadcrumbNode(input.breadcrumb));
    if (input.ogImage) graph.push(imageNode(input.ogImage, input.title, input.ogImageWidth, input.ogImageHeight));

    if (input.pageType === 'article') {
        graph.push({
            '@type': 'Article',
            '@id': `${url}#article`,
            headline: input.title,
            description: input.description,
            datePublished: input.publishedTime,
            dateModified: input.modifiedTime ?? input.publishedTime,
            author: input.authorName
                ? { '@type': 'Person', name: input.authorName }
                : { '@id': `${ORIGIN}/#organization` },
            publisher: { '@id': `${ORIGIN}/#organization` },
            image: input.ogImage ? [input.ogImage] : undefined,
            mainEntityOfPage: { '@id': `${url}#webpage` },
            inLanguage: siteConfig.language,
            isPartOf: { '@id': `${url}#webpage` },
        });
    }

    if (input.pageType === 'product' && input.product) {
        graph.push({
            '@type': 'Product',
            '@id': `${url}#product`,
            name: input.product.name,
            description: input.product.description,
            image: input.product.images.map((i) => assetUrl(i) ?? i),
            sku: input.product.sku || undefined,
            brand: { '@type': 'Brand', name: 'CENNETIC' },
            manufacturer: { '@id': `${ORIGIN}/#organization` },
            category: input.product.categories,
            url,
            // 询盘型展示站无公开标价：不输出 offers/priceSpecification，
            // 编造价格会触发 Google 的结构化数据质量问题
            additionalProperty: undefined,
        });
    }

    // FAQPage 与正文内容必须一一对应，因此由抽取出的问答直接生成
    if (input.faq?.length) {
        graph.push({
            '@type': 'FAQPage',
            mainEntity: input.faq.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
        });
    }

    return { '@context': 'https://schema.org', '@graph': graph };
}
