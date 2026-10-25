/**
 * 后台的“资源清单”：每个可管理的内容类型用一份配置描述，
 * 列表页与编辑页都由它驱动渲染（新增类型＝加配置，不写新代码）。
 * 字段 name 用数据库列名(snake_case)；snapshot 侧负责 snake↔camel 还原。
 */
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
    /** 单例表（如站点设置），无列表、直接编辑唯一行 */
    singleton?: boolean;
    /** 列表页给“预览”按钮，新窗口打开 origin + canonical */
    preview?: boolean;
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
        label: '文章',
        singular: '文章',
        idField: 'slug',
        titleField: 'title',
        orderBy: 'date',
        ascending: false,
        preview: true,
        listCols: [
            { name: 'title', label: '标题' },
            { name: 'status', label: '状态' },
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
            { name: 'faq', label: 'FAQ', type: 'json', full: true, hint: '[{"q":"","a":""}]', help: '结构化问答，可生成搜索富摘要。JSON 数组，每项含 q(问) 与 a(答)。' },
            { name: 'body', label: '正文 (HTML)', type: 'html', full: true, help: '文章正文，直接写/粘 HTML。保存时会自动过滤脚本等不安全内容。' },
        ],
    },
    {
        key: 'pages',
        table: 'pages',
        label: '页面',
        singular: '页面',
        idField: 'slug',
        titleField: 'title',
        orderBy: 'menu_order',
        preview: true,
        listCols: [
            { name: 'title', label: '标题' },
            { name: 'status', label: '状态' },
            { name: 'menu_order', label: '排序' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true, help: '页面地址 /<slug>/。' },
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
            { name: 'faq', label: 'FAQ', type: 'json', full: true },
            { name: 'body', label: '正文 (HTML)', type: 'html', full: true, help: '页面正文 HTML，保存时自动过滤不安全内容。' },
        ],
    },
    {
        key: 'products',
        table: 'products',
        label: '产品',
        singular: '产品',
        idField: 'slug',
        titleField: 'name',
        orderBy: 'name',
        preview: true,
        listCols: [
            { name: 'name', label: '名称' },
            { name: 'slug', label: 'Slug' },
            { name: 'status', label: '状态' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true, help: '产品地址 /product/<slug>/。' },
            { name: 'name', label: '名称', type: 'text', required: true, full: true, quick: true, help: '产品名，也用于列表卡片标题。' },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true, hint: '留空自动' },
            { name: 'summary', label: '简介 (卡片用)', type: 'html', full: true, quick: true, help: '列表卡片/详情顶部的一小段介绍，可含简单 HTML。' },
            { name: 'images', label: '产品主图', type: 'gallery', full: true, help: '点击或拖入上传 5–6 张主图，可左右排序、改 alt、删除；第一张自动作为列表封面。' },
            { name: 'categories', label: '分类', type: 'ref', multiple: true, refTable: 'product_categories', refValue: 'slug', refLabel: 'name', help: '勾选所属产品分类，决定产品出现在哪些分类页/导航。' },
            STATUS,
            { name: 'body', label: '详情 (HTML)', type: 'html', full: true, help: '产品详情整段 HTML：图集、规格表、描述都写在这里(可让 AI 生成后粘贴)。前台列表封面会自动取这里第一张图。保存时自动过滤不安全内容。', sample: PRODUCT_BODY_SAMPLE },
        ],
    },
    {
        key: 'blog_categories',
        table: 'blog_categories',
        label: '博客分类',
        singular: '博客分类',
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
        label: '站点设置',
        singular: '站点设置',
        idField: 'id',
        titleField: 'id',
        orderBy: 'id',
        singleton: true,
        listCols: [],
        fields: [
            { name: 'data', label: '站点配置 (site.json)', type: 'json', full: true, help: '全站配置(公司名/联系方式/地址/社交等)，JSON 格式，谨慎修改。' },
        ],
    },
];

export const NAV = RESOURCES.filter((r) => !r.singleton);
