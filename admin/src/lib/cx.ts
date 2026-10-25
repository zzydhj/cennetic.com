/**
 * 类名拼接：全后台共用同一个 cx，组件不再各写一份。
 * 只处理 string/false/undefined/null 的常见组合，不引入 classnames 依赖。
 */
export function cx(...c: Array<string | false | null | undefined>): string {
    return c.filter(Boolean).join(' ');
}
