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
    | 'json';

export interface Field {
    name: string;
    label: string;
    type: FieldType;
    required?: boolean;
    /** select 的候选值 */
    options?: string[];
    /** ref：来源表 / 取值列 / 显示列 */
    refTable?: string;
    refValue?: string;
    refLabel?: string;
    /** ref 是否多选（数组列，如文章分类） */
    multiple?: boolean;
    /** 占据整行宽度 */
    full?: boolean;
    hint?: string;
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
    /** 唯一列，用于按行定位与 upsert 冲突键 */
    idField: string;
    titleField: string;
    orderBy: string;
    ascending?: boolean;
    /** 单例表（如站点设置），无列表、直接编辑唯一行 */
    singleton?: boolean;
    listCols: ListCol[];
    fields: Field[];
}

const STATUS: Field = {
    name: 'status',
    label: '状态',
    type: 'select',
    options: ['draft', 'published'],
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
        listCols: [
            { name: 'title', label: '标题' },
            { name: 'status', label: '状态' },
            { name: 'date', label: '日期' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'title', label: 'SEO 标题', type: 'text', required: true, full: true },
            { name: 'heading', label: '页面 H1', type: 'text', required: true, full: true },
            { name: 'description', label: '摘要', type: 'textarea', required: true, full: true, hint: '30–255 字符' },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true, hint: '留空按 /slug/ 生成' },
            { name: 'date', label: '发布日期', type: 'text', hint: 'YYYY-MM-DDTHH:MM:SS' },
            { name: 'lastmod', label: '最后修改', type: 'text' },
            { name: 'categories', label: '分类', type: 'ref', multiple: true, refTable: 'blog_categories', refValue: 'slug', refLabel: 'name' },
            { name: 'author', label: '作者', type: 'ref', refTable: 'authors', refValue: 'slug', refLabel: 'name' },
            { name: 'hero', label: '主图 URL', type: 'text', full: true },
            { name: 'hero_alt', label: '主图 alt', type: 'text' },
            { name: 'hero_width', label: '主图宽', type: 'number' },
            { name: 'hero_height', label: '主图高', type: 'number' },
            STATUS,
            { name: 'robots', label: 'Robots', type: 'text', full: true },
            { name: 'faq', label: 'FAQ', type: 'json', full: true, hint: '[{"q":"","a":""}]' },
            { name: 'body', label: '正文 (HTML)', type: 'html', full: true },
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
        listCols: [
            { name: 'title', label: '标题' },
            { name: 'status', label: '状态' },
            { name: 'menu_order', label: '排序' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'title', label: 'SEO 标题', type: 'text', required: true, full: true },
            { name: 'heading', label: '页面 H1', type: 'text', required: true, full: true },
            { name: 'description', label: '摘要', type: 'textarea', full: true },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true },
            { name: 'robots', label: 'Robots', type: 'text', full: true },
            { name: 'date', label: '日期', type: 'text' },
            { name: 'lastmod', label: '最后修改', type: 'text' },
            { name: 'hero', label: '主图 URL', type: 'text', full: true },
            { name: 'menu_order', label: '菜单排序', type: 'number' },
            { name: 'is_listing', label: '列表页', type: 'boolean' },
            { name: 'author', label: '作者', type: 'ref', refTable: 'authors', refValue: 'slug', refLabel: 'name' },
            STATUS,
            { name: 'faq', label: 'FAQ', type: 'json', full: true },
            { name: 'body', label: '正文 (HTML)', type: 'html', full: true },
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
        listCols: [
            { name: 'name', label: '名称' },
            { name: 'slug', label: 'Slug' },
            { name: 'status', label: '状态' },
        ],
        fields: [
            { name: 'slug', label: 'Slug', type: 'text', required: true },
            { name: 'name', label: '名称', type: 'text', required: true, full: true },
            { name: 'canonical', label: 'Canonical', type: 'text', full: true },
            { name: 'summary', label: '简介 (HTML)', type: 'textarea', full: true },
            { name: 'images', label: '图集', type: 'json', full: true, hint: '[{"src","alt","width","height"}]' },
            { name: 'categories', label: '分类', type: 'json', full: true, hint: '[{"slug","name","canonical"}]' },
            { name: 'specs', label: '规格', type: 'json', full: true, hint: '[{"name","values":[]}]' },
            STATUS,
            { name: 'body', label: '详情 (HTML)', type: 'html', full: true },
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
            { name: 'name', label: '名称', type: 'text', required: true, full: true },
            { name: 'description', label: '描述', type: 'textarea', full: true },
            { name: 'title', label: 'SEO 标题', type: 'text', full: true },
            { name: 'robots', label: 'Robots', type: 'text', full: true },
            { name: 'count', label: '文章数', type: 'number' },
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
            { name: 'name', label: '名称', type: 'text', required: true, full: true },
            { name: 'description', label: '描述', type: 'textarea', full: true },
            { name: 'parent', label: '上级 slug', type: 'text', hint: "顶层填 0" },
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
            { name: 'data', label: '站点配置 (site.json)', type: 'json', full: true },
        ],
    },
];

export const NAV = RESOURCES.filter((r) => !r.singleton);
