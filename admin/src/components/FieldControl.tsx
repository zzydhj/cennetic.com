/**
 * 单个字段的渲染器：字段类型 → 控件的唯一映射处。
 * 列表页快改与编辑页共用它，新增字段类型只需在这里加一个 case。
 */
import { useMemo, useState } from 'react';
import { cx } from '../lib/cx';
import type { Field } from '../lib/resources';
import { Icon } from './Icon';
import { Field as FormField, Input, Select, Switch, Textarea, Tooltip } from './ui';
import { ImageField } from './ImageField';
import { HtmlField } from './HtmlField';
import { JsonField } from './JsonField';
import { SiteConfigField } from './SiteConfigField';

export interface RefOption {
    value: string;
    label: string;
}

export function FieldControl({
    field,
    value,
    options = [],
    onChange,
    section,
}: {
    field: Field;
    value: unknown;
    options?: RefOption[];
    onChange: (v: unknown) => void;
    /** 站点配置表单只渲染这一个分组（对应 /site_settings/:section） */
    section?: string;
}): JSX.Element {
    const aside =
        field.hint ??
        (field.type === 'text' || field.type === 'textarea'
            ? `${String(value ?? '').length} 字`
            : undefined);

    const body = (() => {
        switch (field.type) {
            case 'boolean':
                return (
                    <span className="flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 shadow-inner">
                        <Switch checked={!!value} onChange={onChange} label={field.label} />
                        <span className="text-xs font-medium text-slate-600">{value ? '是' : '否'}</span>
                    </span>
                );
            case 'select':
                return (
                    <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                        {(field.options ?? []).map((o) => (
                            <option key={o} value={o}>
                                {o === 'draft' ? 'draft · 草稿（仅后台）' : o === 'published' ? 'published · 已发布（上前台）' : o}
                            </option>
                        ))}
                    </Select>
                );
            case 'ref':
                return field.multiple ? (
                    <RefPicker options={options} value={Array.isArray(value) ? (value as string[]) : []} onChange={onChange} />
                ) : (
                    <Select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
                        <option value="">（无）</option>
                        {options.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </Select>
                );
            case 'tags': {
                const arr = Array.isArray(value) ? (value as string[]) : [];
                return (
                    <Textarea
                        rows={3}
                        mono
                        value={arr.join('\n')}
                        placeholder="每行一个"
                        onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                    />
                );
            }
            case 'json':
                /* 站点配置走专属表单；其余结构化数组（FAQ 等）仍是 JSON 编辑 */
                if (field.formMode) return <SiteConfigField value={value} onChange={onChange} section={section} />;
                return <JsonField value={value} onChange={onChange} label={field.name === 'data' ? '顶层键' : '条目'} rows={10} />;
            case 'html':
                return <HtmlField value={value} onChange={onChange} sample={field.sample} help={field.help} rows={16} />;
            case 'textarea':
                return <Textarea rows={4} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
            case 'number':
                return <Input type="number" value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} />;
            case 'image':
                return <ImageField multiple={false} value={value} onChange={onChange} />;
            case 'gallery':
                return <ImageField multiple max={field.max} value={value} onChange={onChange} />;
            default:
                return (
                    <Input
                        value={String(value ?? '')}
                        placeholder={field.hint}
                        onChange={(e) => onChange(e.target.value)}
                        className={field.name === 'slug' ? 'font-mono text-xs' : undefined}
                    />
                );
        }
    })();

    /* html 字段自带说明与工具条，不再套一层 Field，避免说明重复 */
    if (field.type === 'html') return body;

    return (
        <FormField
            label={field.label}
            required={field.required}
            help={field.type === 'boolean' ? undefined : field.help}
            aside={aside}
            className={field.full ? 'md:col-span-2' : undefined}
        >
            {body}
        </FormField>
    );
}

/** 多选关联：已选做成可删的 chip，候选可搜索，长列表不再靠滚 */
function RefPicker({
    options,
    value,
    onChange,
}: {
    options: RefOption[];
    value: string[];
    onChange: (v: string[]) => void;
}): JSX.Element {
    const [q, setQ] = useState('');
    const shown = useMemo(() => {
        const s = q.trim().toLowerCase();
        return s ? options.filter((o) => `${o.label} ${o.value}`.toLowerCase().includes(s)) : options;
    }, [options, q]);

    const toggle = (v: string): void => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

    return (
        <div className="rounded-lg border border-slate-200/90 bg-white shadow-inner">
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-b border-slate-100 p-2">
                    {value.map((v) => {
                        const label = options.find((o) => o.value === v)?.label ?? v;
                        return (
                            <span
                                key={v}
                                className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-1 text-[11px] font-medium text-brand-700 ring-1 ring-inset ring-brand-100"
                            >
                                {label}
                                <button
                                    type="button"
                                    onClick={() => toggle(v)}
                                    aria-label={`移除 ${label}`}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-500 transition-colors hover:bg-brand-100 hover:text-accent"
                                >
                                    <Icon name="close" className="h-2.5 w-2.5" strokeWidth={2.2} />
                                </button>
                            </span>
                        );
                    })}
                </div>
            )}
            <div className="p-2">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索候选项…" className="mb-1.5 h-8 text-xs" />
                <div className="max-h-44 space-y-0.5 overflow-y-auto">
                    {shown.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-slate-400">没有候选项</p>}
                    {shown.map((o) => {
                        const on = value.includes(o.value);
                        return (
                            <label
                                key={o.value}
                                className={cx(
                                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors',
                                    on ? 'bg-brand-50/70 text-brand-800' : 'text-slate-600 hover:bg-slate-50',
                                )}
                            >
                                <input type="checkbox" checked={on} onChange={() => toggle(o.value)} className="h-4 w-4 rounded border-slate-300 accent-[#012760]" />
                                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                <span className="shrink-0 font-mono text-[10px] text-slate-400">{o.value}</span>
                            </label>
                        );
                    })}
                </div>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">
                <Icon name="checkCircle" className="h-3 w-3" />
                已选 {value.length} / {options.length}
                <Tooltip text="勾选决定这条内容出现在哪些分类/作者页面；取消勾选即从该页消失。">
                    <span className="ml-auto cursor-help font-medium text-slate-400 hover:text-brand-600">说明</span>
                </Tooltip>
            </div>
        </div>
    );
}
