/**
 * 代码自有的「锁定页」清单 —— 内容的真源在 git，不在 Supabase。
 *
 * 这些页几乎不改，且呈现方式（页头对齐、背景图、工厂图集、询盘表单插槽）
 * 本来就是后台表单表达不了的，所以刻意做成 src/pages/<slug>.astro 静态路由，
 * 后台不开放编辑，快照也不该为它们写内容文件。
 *
 * 为什么必须集中列这一份：同一个路径若被静态路由与 [slug].astro 各渲染一次，
 * HTML 会被后写的覆盖、样式清单却错拿另一版，表现为「整页样式莫名丢失」，
 * 而构建完全不报错（/contact-us/ 曾真实踩过，见 [slug].astro 的注释）。
 * 路由排除与快照守卫两边都读这一份，避免加一个锁定页就漏改一处。
 */
export const CODE_OWNED_PAGE_SLUGS: readonly string[] = [
    "about-us",
    "service",
    "privacy-policy",
    "cnc-machine-refund-policy",
];

export function isCodeOwnedPage(slug: string): boolean {
    return CODE_OWNED_PAGE_SLUGS.includes(slug);
}
