/**
 * 后台的“资源清单”：每个可管理的内容类型用一份配置描述，
 * 列表页与编辑页都由它驱动渲染（新增类型＝加配置，不写新代码）。
 * 字段 name 用数据库列名(snake_case)；snapshot 侧负责 snake↔camel 还原。
 */
import type { IconName } from '../components/Icon';

/** 侧边栏分组（顺序即渲染顺序） */
export type NavGroup = '内容' | '分类与作者' | '系统';

export type FieldType =
    | 'text'
    | 'textarea'
    | 'html'
    | 'number'
    | 'boolean'
    | 'tags'
    | 'ref'
    | 'select'
    | 'json'
    | 'faq'
    | 'image'
    | 'gallery';

export interface Field {
    name: string;
    label: string;
    type: FieldType;
    required?: boolean;
    /** 悬停“?”气泡里的用法说明 */
    help?: string;
    /** 出现在列表页的“就地快改”面板 */
    quick?: boolean;
    /** select 的候选值 */
    options?: string[];
    /** ref：来源表 / 取值列 / 显示列 */
    refTable?: string;
    refValue?: string;
    refLabel?: string;
    /** ref 是否多选（数组列） */
    multiple?: boolean;
    /** 占据整行宽度 */
    full?: boolean;
    hint?: string;
    /** html 字段的示例模板：编辑页提供“查看/插入模板”按钮 */
    sample?: string;
    /** html 字段用矮版编辑区：简介这类一两句的字段不占一整屏 */
    compact?: boolean;
    /** image/gallery 字段的最大张数 */
    max?: number;
    /** json 字段改用专属业务表单渲染（站点设置），仍产出同样的 JSON 文本 */
    formMode?: boolean;
}

export interface ListCol {
    name: string;
    label: string;
}

export interface Resource {
    key: string;
    table: string;
    label: string;
    singular: string;
    idField: string;
    titleField: string;
    orderBy: string;
    ascending?: boolean;
    /**
     * 这张表有没有 updated_at 列（仪表盘的「最近改动」与趋势图按它取数）。
     * 以 supabase/schema.sql 为准：articles / pages / products / site_settings 有，
     * 分类与作者这三张参照表没有（schema.sql 的 updated_at 触发器也只挂可变表）。
     * 漏标会让 PostgREST 报 42703 并返回 400，那一类内容就从时间线里静默消失。
     */
    hasUpdatedAt?: boolean;
    /** 单例表（如站点设置），无列表、直接编辑唯一行 */
    singleton?: boolean;
    /** 单例表没有可读的标题列时用它（站点设置的 id 是布尔 true，不能直接当标题显示） */
    displayName?: string;
    /** 列表页给“预览”按钮，新窗口打开 origin + canonical */
    preview?: boolean;
    /** 侧边栏分组与图标 */
    group: NavGroup;
    icon: IconName;
    /** 仪表盘与列表页上的一句话说明 */
    desc?: string;
    /** 列表页要显示的列；状态列由 StatusBadge 自动追加，这里不要重复写 */
    listCols: ListCol[];
    fields: Field[];
}

/** 产品详情 HTML 的示例模板（编辑页“查看/插入模板”用） */
const PRODUCT_BODY_SAMPLE = `<!-- 不要写 <h1>（页面标题由系统生成）；第一张 <img> 会自动当作列表封面 -->
<h2>产品亮点</h2>
<p>用一两句话讲这台机器解决什么问题。</p>

<h2>图片</h2>
<img src="图片URL" alt="说明" width="1200" height="800" loading="lazy">

<h2>技术参数</h2>
<table>
  <tbody>
    <tr><th>工作台尺寸</th><td>1200 × 500 mm</td></tr>
    <tr><th>主轴转速</th><td>12000 rpm</td></tr>
  </tbody>
</table>

<h2>应用领域</h2>
<ul><li>汽车零部件</li><li>模具</li></ul>`;

const STATUS: Field = {
    name: 'status',
    label: '状态',
    type: 'select',
    options: ['draft', 'published'],
    quick: true,
    help: 'draft=草稿，仅后台可见；published=已发布，会进入前台静态站（需经发布流程）。',
};

export const RESOURCES: Resource[] = [
    {
        key: 'articles',
        table: 'articles',
        hasUpdatedAt: true,
        label: '文章',
        singular: '文章',
        group: '内容',
        icon: 'article',
        desc: '博客与技术文章，前台地址 /<slug>/',
        idField: 'slug',
        titleField: 'title',
        orderBy: 'date',
        ascending: false,
        preview: true,
        listCols: [
            { name: 'title', label: '标题' },
            { name: 'date', label: '日期' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true, help: '网址里那截标识，前台地址是 /<slug>/。定好后尽量别改，改了旧链接要做 301。' },
            { name: 'title', label: 'SEO 标题', type: 'text', required: true, full: true, quick: true, help: '浏览器标签 + Google 搜索结果里的蓝标题 + 分享卡标题。可与页面 H1 不同。' },
            { name: 'heading', label: '页面 H1', type: 'text', required: true, full: true, help: '打开页面后最上面那个可见大标题。' },
            { name: 'description', label: '摘要', type: 'textarea', required: true, full: true, quick: true, hint: '30–255 字符', help: 'Google 结果标题下的两行说明(meta description)，影响点击率。' },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true, hint: '留空自动', help: '告诉搜索引擎本页的权威地址，防重复内容。一般留空(自动=本页)。' },
            { name: 'date', label: '发布日期', type: 'text', help: '格式 YYYY-MM-DDTHH:MM:SS。' },
            { name: 'lastmod', label: '最后修改', type: 'text' },
            { name: 'categories', label: '分类', type: 'ref', multiple: true, refTable: 'blog_categories', refValue: 'slug', refLabel: 'name', help: '勾选所属博客分类，决定文章出现在哪些分类页。' },
            { name: 'author', label: '作者', type: 'ref', refTable: 'authors', refValue: 'slug', refLabel: 'name' },
            { name: 'hero', label: '主图', type: 'image', full: true, help: '上传或填写文章顶部大图/分享图（点上方虚线框即可上传）。' },
            { name: 'hero_alt', label: '主图 alt', type: 'text', help: '图片替代文字，利于 SEO 与无障碍。' },
            { name: 'hero_width', label: '主图宽', type: 'number' },
            { name: 'hero_height', label: '主图高', type: 'number' },
            STATUS,
            { name: 'robots', label: 'Robots', type: 'text', full: true, help: '搜索引擎指令。收录=follow, index…；想隐藏该页加 noindex。一般留默认。' },
            { name: 'faq', label: 'FAQ 问答', type: 'faq', full: true, help: '逐条填问答：保存后可能以可展开问答下拉出现在 Google 搜索结果下方，页面也会渲染问答区。不用写任何代码，不需要就留空。' },
            { name: 'body', label: '正文 (HTML)', type: 'html', full: true, help: '默认纯文本模式：直接写字，空一行=新段落，系统自动包段落标签；带表格/样式的旧正文会自动切源码模式。保存时自动过滤不安全内容。' },
        ],
    },
    {
        key: 'pages',
        table: 'pages',
        hasUpdatedAt: true,
        label: '页面',
        singular: '页面',
        group: '内容',
        icon: 'page',
        desc: '固定页（联系页、Blog/Products 等列表页的引言与 SEO）。注意：About Us、Service、隐私政策、退款政策这 4 页已写死在代码里、不在后台管理，列表里看不到是正常的，也别用同名 slug 重建。',
        idField: 'slug',
        titleField: 'title',
        orderBy: 'menu_order',
        preview: true,
        listCols: [
            { name: 'title', label: '标题' },
            { name: 'menu_order', label: '排序' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true, help: '页面地址 /<slug>/。about-us / service / privacy-policy / cnc-machine-refund-policy 是代码保留 slug，用了会跟静态路由撞成同一个 URL，发布闸会直接拦住。' },
            { name: 'title', label: 'SEO 标题', type: 'text', required: true, full: true, quick: true },
            { name: 'heading', label: '页面 H1', type: 'text', required: true, full: true },
            { name: 'description', label: '摘要', type: 'textarea', full: true, quick: true },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true, hint: '留空自动' },
            { name: 'robots', label: 'Robots', type: 'text', full: true },
            { name: 'date', label: '日期', type: 'text' },
            { name: 'lastmod', label: '最后修改', type: 'text' },
            { name: 'hero', label: '主图', type: 'image', full: true },
            { name: 'menu_order', label: '菜单排序', type: 'number', help: '数字越小越靠前。' },
            { name: 'is_listing', label: '列表页', type: 'boolean', help: '主体是列表的页(如 /blog/ /products/)，正文只当列表上方引言。' },
            { name: 'author', label: '作者', type: 'ref', refTable: 'authors', refValue: 'slug', refLabel: 'name' },
            STATUS,
            { name: 'faq', label: 'FAQ 问答', type: 'faq', full: true, help: '逐条填问答：保存后可能以可展开问答下拉出现在 Google 搜索结果下方，页面也会渲染问答区。不用写任何代码，不需要就留空。' },
            { name: 'body', label: '正文 (HTML)', type: 'html', full: true, help: '默认纯文本模式：直接写字，空一行=新段落，系统自动包段落标签；带表格/样式的内容会自动切源码模式。保存时自动过滤不安全内容。' },
        ],
    },
    {
        key: 'products',
        table: 'products',
        hasUpdatedAt: true,
        label: '产品',
        singular: '产品',
        group: '内容',
        icon: 'product',
        desc: '机器型号，前台地址 /product/<slug>/',
        idField: 'slug',
        titleField: 'name',
        orderBy: 'name',
        preview: true,
        listCols: [
            { name: 'name', label: '名称' },
            { name: 'slug', label: 'Slug' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true, help: '产品地址 /product/<slug>/。' },
            { name: 'name', label: '名称', type: 'text', required: true, full: true, quick: true, help: '产品名，也用于列表卡片标题。' },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true, hint: '留空自动' },
            { name: 'summary', label: '简介 (卡片用)', type: 'html', full: true, quick: true, compact: true, help: '列表卡片/详情顶部的一小段介绍。纯文本直接写即可，系统自动包段落；也可含简单 HTML。' },
            { name: 'images', label: '产品主图', type: 'gallery', full: true, max: 5, help: '固定 5 个方格一排，从左往右依次填，没传的位置留空。缩略图按 1:1 居中裁切看版式（不会改原图），建议直接传方图（如 1024×1024）。第一张自动作为列表封面；可左右排序、改 alt、删除，大图自动压缩。' },
            { name: 'categories', label: '分类', type: 'ref', multiple: true, refTable: 'product_categories', refValue: 'slug', refLabel: 'name', help: '勾选所属产品分类，决定产品出现在哪些分类页/导航。' },
            STATUS,
            { name: 'body', label: '详情 (HTML)', type: 'html', full: true, help: '产品详情整段：新内容用纯文本模式直接写(空一行=新段落)，整段 <style> CSS 也会原样保留；带图集/规格表的存量详情在源码模式(可让 AI 生成后粘贴)。前台列表封面会自动取这里第一张图。保存时自动过滤不安全内容。', sample: PRODUCT_BODY_SAMPLE },
            { name: 'faq', label: 'FAQ 问答', type: 'faq', full: true, help: '逐条填问答：保存后产品页底部会渲染问答区，并可能以可展开问答下拉出现在 Google 搜索结果下方。不用写任何代码，不需要就留空。' },
        ],
    },
    {
        key: 'blog_categories',
        table: 'blog_categories',
        label: '博客分类',
        singular: '博客分类',
        group: '分类与作者',
        icon: 'tag',
        idField: 'slug',
        titleField: 'name',
        orderBy: 'name',
        listCols: [
            { name: 'name', label: '名称' },
            { name: 'slug', label: 'Slug' },
            { name: 'count', label: '文章数' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'name', label: '名称', type: 'text', required: true, full: true, quick: true },
            { name: 'description', label: '描述', type: 'textarea', full: true },
            { name: 'title', label: 'SEO 标题', type: 'text', full: true },
            { name: 'robots', label: 'Robots', type: 'text', full: true },
            { name: 'count', label: '文章数', type: 'number', help: '展示用计数；列表页实际按查询渲染。' },
        ],
    },
    {
        key: 'product_categories',
        table: 'product_categories',
        label: '产品分类',
        singular: '产品分类',
        group: '分类与作者',
        icon: 'folder',
        idField: 'slug',
        titleField: 'name',
        orderBy: 'canonical',
        listCols: [
            { name: 'name', label: '名称' },
            { name: 'slug', label: 'Slug' },
            { name: 'parent', label: '上级' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'name', label: '名称', type: 'text', required: true, full: true, quick: true },
            { name: 'description', label: '描述', type: 'textarea', full: true },
            { name: 'parent', label: '上级 slug', type: 'text', hint: '顶层填 0' },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true },
            { name: 'trail', label: '祖先链', type: 'tags', full: true, hint: '每行一个 slug' },
            { name: 'robots', label: 'Robots', type: 'text', full: true },
            { name: 'title', label: 'SEO 标题', type: 'text', full: true },
            { name: 'count', label: '产品数', type: 'number' },
        ],
    },
    {
        key: 'authors',
        table: 'authors',
        label: '作者',
        singular: '作者',
        group: '分类与作者',
        icon: 'user',
        idField: 'slug',
        titleField: 'name',
        orderBy: 'name',
        listCols: [
            { name: 'name', label: '名称' },
            { name: 'slug', label: 'Slug' },
            { name: 'role', label: '职位' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'name', label: '名称', type: 'text', required: true },
            { name: 'role', label: '职位', type: 'text', full: true },
            { name: 'bio', label: '简介', type: 'textarea', full: true },
            { name: 'avatar', label: '头像', type: 'text', full: true },
        ],
    },
    {
        key: 'site_settings',
        table: 'site_settings',
        hasUpdatedAt: true,
        label: '站点设置',
        singular: '站点设置',
        group: '系统',
        icon: 'settings',
        idField: 'id',
        titleField: 'id',
        orderBy: 'id',
        singleton: true,
        displayName: '站点设置',
        desc: '全站共用的一份配置：公司名、网址、联系方式、导航与社交账号。表单里改常用项即可，没列出的字段会原样保留。',
        listCols: [],
        fields: [
            {
                name: 'data',
                label: '站点配置',
                type: 'json',
                full: true,
                formMode: true,
                help: '前台每个页面都读这里。表单只能改字段的值，改不动结构，语法也永远合法；需要新增字段由开发在代码里加。改完保存再点顶栏「发布上线」才会生效；改错不会弄坏线上，但发布会被回归闸拦下。',
            },
        ],
    },
];

/** 侧边栏与仪表盘用的列表（排除单例的站点设置） */
export const NAV = RESOURCES.filter((r) => !r.singleton);

/** 按分组输出：只给命令面板当「这是哪一类」的提示用，侧栏已不再分组 */
export const NAV_GROUPS: Array<{ group: NavGroup; items: Resource[] }> = (['内容', '分类与作者', '系统'] as NavGroup[])
    .map((g) => ({ group: g, items: RESOURCES.filter((r) => r.group === g && !r.singleton) }))
    .filter((x) => x.items.length > 0);

export interface RailLink {
    to: string;
    label: string;
    icon: IconName;
    /** 对应的资源表，用来显示条数与草稿点 */
    key?: string;
    /** 全站级入口（站点设置）：用香槟金标识区分 */
    accent?: boolean;
    /** 二级入口：站点设置按分组拆出的子页 */
    children?: RailLink[];
}

export interface SiteSection {
    key: string;
    label: string;
    icon: IconName;
    desc: string;
}

/** 站点设置的二级页：同一行数据按分组拆成独立路由，侧栏在「站点设置」下展开显示 */
export const SITE_SECTIONS: SiteSection[] = [
    { key: 'brand', label: '品牌与站点地址', icon: 'factory', desc: '页眉、标题、sitemap 与分享链接都读这一段' },
    { key: 'contact', label: '联系方式', icon: 'mail', desc: '电话、邮箱、WhatsApp 与结构化地址' },
    { key: 'inquiry', label: '询盘接收邮箱', icon: 'inbox', desc: '询盘统一转发到这里，后台只存地址' },
    { key: 'media', label: '图片与首页素材', icon: 'image', desc: 'Logo、分享封面、背景视频与工厂视频' },
    { key: 'scripts', label: '第三方脚本', icon: 'code', desc: 'GA / Tawk 的 ID，留空即不加载对应脚本' },
];

const toRailLink = (r: Resource): RailLink => ({ to: `/${r.key}`, label: r.label, icon: r.icon, key: r.key });

/**
 * 侧栏：全一级平铺，不再分组。顺序：
 * 仪表盘 → 文章 → 页面 → 产品 → 媒体库 → 博客分类 → 产品分类 → 作者 → 站点设置
 * 由 NAV 派生而不是写死，以后新增资源会自动排在作者前后这一片里。
 */
export const RAIL_LINKS: RailLink[] = [
    { to: '/', label: '仪表盘', icon: 'dashboard' },
    ...NAV.slice(0, 3).map(toRailLink),
    { to: '/media', label: '媒体库', icon: 'image' },
    ...NAV.slice(3).map(toRailLink),
    {
        to: '/site_settings',
        label: '站点设置',
        icon: 'settings',
        accent: true,
        children: SITE_SECTIONS.map((s) => ({ to: `/site_settings/${s.key}`, label: s.label, icon: s.icon })),
    },
];
