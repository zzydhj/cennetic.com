/**
 * WhatsApp 深链构造 —— 全站唯一入口。
 *
 * 询价表单已按需求移除，所有 CTA 改为 WhatsApp。原先指向 /contact-us/ 的
 * 108 个正文 CTA 按钮统一走这里生成，预填文案带上来源页面，便于对方一眼知道在问哪台机器。
 *
 * 配置由调用方注入（Astro 侧 import site.json，脚本侧读同一份文件），
 * 本模块不直接 import JSON，避免两种运行环境的 JSON 导入语法差异。
 */

export interface WaConfig {
    /** 纯数字，含国家码，不带 + 号 */
    number: string;
    /** 站点基址，用于在预填文案里带上来源页 */
    siteUrl: string;
}

export interface WaOptions {
    /** 预填消息正文 */
    text?: string;
    /** 关联的产品/页面标题，会拼进预填文案 */
    subject?: string;
}

/** 构造 wa.me 链接 */
export function waLink(cfg: WaConfig, opts: WaOptions = {}): string {
    const parts: string[] = [];

    if (opts.subject) parts.push(`Hi QiaoFeng, I'm interested in ${opts.subject}.`);
    if (opts.text) parts.push(opts.text);
    parts.push(`${cfg.siteUrl}/`);

    const text = encodeURIComponent(parts.join(' '));
    return `https://wa.me/${cfg.number}?text=${text}`;
}

/**
 * 文章正文 CTA 的默认文案：说明读者正在看哪篇内容，
 * 让 Bella 不用反问就能对上上下文。
 */
export function waLinkForArticle(cfg: WaConfig, articleTitle: string, articleUrl: string): string {
    const text = encodeURIComponent(
        `Hi QiaoFeng, I just read "${articleTitle}" on ${articleUrl} and would like your recommendation.`,
    );
    return `https://wa.me/${cfg.number}?text=${text}`;
}
