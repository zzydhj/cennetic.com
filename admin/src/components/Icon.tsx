/**
 * 后台图标：统一 24 网格、1.5 描边、currentColor。
 * 只放真正用到的，避免引入图标库这种"看起来免费"的体积与依赖成本。
 * 允许多段路径写在同一个 d 里（用 M 起笔），因此一个 icon = 一个字符串。
 */
import type { SVGProps } from 'react';

export type IconName =
    /* 导航与结构 */
    | 'dashboard'
    | 'article'
    | 'page'
    | 'product'
    | 'tag'
    | 'folder'
    | 'user'
    | 'users'
    | 'settings'
    | 'image'
    | 'play'
    | 'layers'
    | 'grid'
    | 'list'
    /* 动作 */
    | 'search'
    | 'plus'
    | 'minus'
    | 'pencil'
    | 'eye'
    | 'eyeOff'
    | 'trash'
    | 'check'
    | 'checkCircle'
    | 'close'
    | 'copy'
    | 'link'
    | 'download'
    | 'upload'
    | 'external'
    | 'refresh'
    | 'sort'
    | 'grip'
    | 'filter'
    | 'command'
    | 'logout'
    /* 状态与语义 */
    | 'alert'
    | 'clock'
    | 'history'
    | 'calendar'
    | 'shield'
    | 'lock'
    | 'mail'
    | 'globe'
    | 'database'
    | 'branch'
    | 'rocket'
    | 'sparkle'
    | 'bolt'
    | 'star'
    | 'bell'
    | 'inbox'
    | 'code'
    | 'braces'
    | 'factory'
    | 'trendUp'
    | 'trendDown'
    | 'gauge'
    | 'dot'
    | 'help'
    /* 方向 */
    | 'chevronLeft'
    | 'chevronRight'
    | 'chevronDown'
    | 'chevronUp'
    | 'arrowUpRight'
    | 'dots';

const paths: Record<IconName, string> = {
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.3 9a2.8 2.8 0 0 1 5.4 1c0 1.8-2.7 2.3-2.7 3.9M12 17h.01',
    dashboard: 'M4 5h7v6H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 13h7v6H4z',
    article: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h7M10 16h7',
    page: 'M6 3h9l3 3v15H6zM15 3v3h3M9 11h6M9 15h4',
    product: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
    tag: 'M4 4h7l9 9-7 7-9-9zM8 8h.01',
    folder: 'M3 6h6l2 2h10v11H3zM3 10h18',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6',
    users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3.1-6 7-6s7 2 7 6M16.5 3.6a4 4 0 0 1 0 7.8M18 15.2c2.4.7 3.6 2.5 3.6 5.3',
    settings: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6',
    image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M9 9h.01',
    play: 'M8 5.2v13.6L19 12z',
    layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',

    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    pencil: 'M4 20h4L20 8l-4-4L4 16zM14 6l4 4',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M9.9 10a3 3 0 0 0 4.1 4.1M6.6 7.4C3.9 9 2 12 2 12s3.6 7 10 7c1.7 0 3.2-.4 4.5-1.1M19.4 15.1C20.9 13.7 22 12 22 12s-3.6-7-10-7c-.6 0-1.2 0-1.8.1',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
    check: 'M4 12l5 5L20 6',
    checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.2 12.4l2.6 2.6 5-5.2',
    close: 'M6 6l12 12M18 6L6 18',
    copy: 'M8 8h11v12H8zM5 16H3V4h11v2',
    link: 'M10.5 13.5a4.6 4.6 0 0 0 6.5 0l2.5-2.5a4.6 4.6 0 0 0-6.5-6.5L12 6M13.5 10.5a4.6 4.6 0 0 0-6.5 0L4.5 13a4.6 4.6 0 0 0 6.5 6.5L12 18',
    download: 'M12 3v12M7 11l5 5 5-5M4 21h16',
    upload: 'M12 21V9M7 13l5-5 5 5M4 3h16',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    refresh: 'M20.5 12a8.5 8.5 0 1 1-3.2-6.6M20.5 4v5h-5',
    sort: 'M8 10l4-5 4 5M8 14l4 5 4-5',
    grip: 'M9.5 6h.01M9.5 12h.01M9.5 18h.01M14.5 6h.01M14.5 12h.01M14.5 18h.01',
    filter: 'M4 5h16M6 10h12M8.5 15h7M11 20h2',
    command: 'M18 9V6.5A2.5 2.5 0 1 0 15.5 9zM6 9V6.5A2.5 2.5 0 1 1 8.5 9zM18 15v2.5A2.5 2.5 0 1 1 15.5 15zM6 15v2.5A2.5 2.5 0 1 0 8.5 15zM9 9h6v6H9z',
    logout: 'M9 5H4v14h5M15 8l4 4-4 4M19 12H9',

    alert: 'M12 4l9 16H3zM12 10v5M12 18h.01',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    history: 'M12 8v5l3.5 2M3.5 12a8.5 8.5 0 1 0 3.2-6.6M3.5 4v5h5',
    calendar: 'M4 6h16v15H4zM4 10.5h16M9 3.5v4M15 3.5v4M8 15h3',
    shield: 'M12 3l8 3v6c0 5-3.4 7.6-8 9-4.6-1.4-8-4-8-9V6zM9.2 12l2 2 3.6-4',
    lock: 'M6 11h12v9H6zM9.2 11V8a2.8 2.8 0 0 1 5.6 0v3',
    mail: 'M3 6h18v12H3zM3.5 7l8.5 6 8.5-6',
    globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.2 9.5h17.6M3.2 14.5h17.6M12 3c3 3.6 3 14.4 0 18M12 3c-3 3.6-3 14.4 0 18',
    database: 'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    branch: 'M7 4v16M7 12h4a4 4 0 0 0 4-4V7M15 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM17 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    rocket: 'M6 18c-2-6 2-12 9-14 2 7-2 12-9 14zM6 18l-2 2M10 9a2 2 0 1 0 4 0 2 2 0 0 0-4 0z',
    sparkle: 'M11 3l1.7 4.8L17.5 9.5l-4.8 1.7L11 16l-1.7-4.8L4.5 9.5l4.8-1.7zM18 15l.9 2.4 2.4.9-2.4.9L18 22l-.9-2.8-2.4-.9 2.4-.9z',
    bolt: 'M13 3L5.5 13.5H10l-1 7.5 8.5-11H13z',
    star: 'M12 4l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.8-5.2 2.8 1-5.7-4.1-4 5.7-.8z',
    bell: 'M6 16.5V10a6 6 0 1 1 12 0v6.5l1.8 2.5H4.2zM9.8 21a2.4 2.4 0 0 0 4.4 0',
    inbox: 'M4 5h16v14H4zM2.5 13h5.2l1.6 2.6h5.4L16.3 13h5.2',
    code: 'M9 8l-4 4 4 4M15 8l4 4-4 4M13.5 5l-3 14',
    braces: 'M8.5 4.5C6.2 4.5 5.5 6 5.5 7.8v2.1c0 1.5-.9 2.6-2.5 2.6 1.6 0 2.5 1.1 2.5 2.6v2.1c0 1.8.7 3.2 3 3.2M15.5 4.5c2.3 0 3 1.5 3 3.3v2.1c0 1.5.9 2.6 2.5 2.6-1.6 0-2.5 1.1-2.5 2.6v2.1c0 1.8-.7 3.2-3 3.2',
    factory: 'M3 20V9.5l5.5 3.5V9.5L14 13V9.5l7 4V20zM3 20h18M7.5 16.5h2M14 16.5h2.5',
    trendUp: 'M3 17l6-6 4 4 8-8M15 7h6v6',
    trendDown: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
    gauge: 'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 12.5l4-3.5M12 17.5h.01',
    dot: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',

    chevronLeft: 'M15 6l-6 6 6 6',
    chevronRight: 'M9 6l6 6-6 6',
    chevronDown: 'M6 9l6 6 6-6',
    chevronUp: 'M6 15l6-6 6 6',
    arrowUpRight: 'M7 17L17 7M9 7h8v8',
    dots: 'M12 5.5h.01M12 12h.01M12 18.5h.01',
};

export function Icon({
    name,
    className = 'h-4 w-4',
    strokeWidth = 1.5,
    ...rest
}: { name: IconName } & SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...rest}
        >
            <path d={paths[name]} />
        </svg>
    );
}
