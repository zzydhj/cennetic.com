/**
 * 西尔普上架目录:pid(product_view 的编号)→ slug / 型号 / 英文名 / 类型 / 分类 / 英文概述。
 *
 * 品牌按用户决定改挂 CENNETIC(标题与文案不出现西尔普;制造商事实见 body 结尾说明)。
 * 概述只写机型层面的事实(结构/用途),具体数字交给 specs 表,避免编造。
 * 分类:五轴 → 新建 5-axis-machining-centers;立式/卧式/钻攻 → machining-centers;车床 → cnc-lathes。
 */

export interface CatalogEntry {
    pid: string;
    slug: string;
    model: string;
    name: string;
    type: "5axis" | "vertical" | "horizontal" | "drilltap" | "lathe";
    summary: string;
}

export const TYPE_LABEL: Record<CatalogEntry["type"], string> = {
    "5axis": "5-Axis Machining Center",
    vertical: "Vertical Machining Center",
    horizontal: "Horizontal Machining Center",
    drilltap: "Drilling & Tapping Center",
    lathe: "CNC Lathe / Turn-Mill Center",
};

export const CATEGORY_BY_TYPE: Record<
    CatalogEntry["type"],
    { slug: string; name: string }
> = {
    "5axis": { slug: "5-axis-machining-centers", name: "5-Axis Machining Centers" },
    vertical: { slug: "machining-centers", name: "Machining Centers (Milling-Focused)" },
    horizontal: { slug: "machining-centers", name: "Machining Centers (Milling-Focused)" },
    drilltap: { slug: "machining-centers", name: "Machining Centers (Milling-Focused)" },
    lathe: { slug: "cnc-lathes", name: "CNC Lathes, Swiss-Type & Automatic Lathes" },
};

const S = (core: string, extra = "") =>
    `<p>${core}${extra ? " " + extra : ""}</p>`;

export const CATALOG: CatalogEntry[] = [
    // ——— 五轴 ———
    { pid: "291", slug: "c600-trunnion-5-axis-machining-center", model: "C600", type: "5axis", name: "CENNETIC C600 Trunnion 5-Axis Machining Center", summary: S("The C600 is a trunnion-type 5-axis machining center built for simultaneous 5-face machining of complex parts. Its A/C rotary table suits aerospace, automotive and mold components that need tight angular accuracy in a single setup.") },
    { pid: "290", slug: "c400-trunnion-5-axis-machining-center", model: "C400", type: "5axis", name: "CENNETIC C400 Heavy-Duty Trunnion 5-Axis Machining Center", summary: S("The C400 is a high-rigidity trunnion 5-axis machining center designed for heavy cutting on tough materials, combining a robust cast bed with direct-drive rotary axes for accurate multi-axis profiling.") },
    { pid: "293", slug: "c300-5-trunnion-5-axis-machining-center", model: "C300-5", type: "5axis", name: "CENNETIC C300-5 Trunnion 5-Axis Machining Center", summary: S("The C300-5 is a compact trunnion 5-axis machining center for precise simultaneous 5-axis machining of small-to-medium parts, ideal for impellers, fittings and multi-face components.") },
    { pid: "285", slug: "m5-5-vertical-5-axis-machining-center", model: "M5-5", type: "5axis", name: "CENNETIC M5-5 High-Rigidity 5-Axis Machining Center", summary: S("The M5-5 is a high-rigidity 5-axis machining center that adds continuous rotary axes to a vertical machining platform, delivering complex-contour capability without leaving the machine.") },
    { pid: "287", slug: "z300-vertical-5-axis-machining-center", model: "Z300", type: "5axis", name: "CENNETIC Z300 High-Rigidity 5-Axis Machining Center", summary: S("The Z300 is a high-rigidity 5-axis machining center for accurate multi-axis machining of structural and prismatic parts in a single setup.") },
    { pid: "264", slug: "fa200-compact-5-axis-machining-center", model: "FA200", type: "5axis", name: "CENNETIC FA200 Compact 5-Axis Machining Center", summary: S("The FA200 is a compact 5-axis machining center that brings simultaneous 5-axis machining to small parts and tight production floors.") },
    { pid: "265", slug: "fa200-5-compact-5-axis-machining-center", model: "FA200-5", type: "5axis", name: "CENNETIC FA200-5 Compact 5-Axis Machining Center", summary: S("The FA200-5 is a compact 5-axis machining center for high-precision 5-sided and simultaneous 5-axis work on small components.") },
    { pid: "282", slug: "fa400-gantry-5-axis-machining-center", model: "FA400", type: "5axis", name: "CENNETIC FA400 Gantry 5-Axis Machining Center", summary: S("The FA400 is a gantry-type 5-axis machining center for large, heavy multi-axis parts, using a rigid gantry frame to hold accuracy over a big working envelope.") },

    // ——— 立式 ———
    { pid: "298", slug: "m6-vertical-machining-center", model: "M6", type: "vertical", name: "CENNETIC M6 High-Rigidity Vertical Machining Center", summary: S("The M6 is a high-rigidity vertical machining center for mold and general parts machining, built for stable finishing and heavy cuts.") },
    { pid: "286", slug: "m5a-mold-vertical-machining-center", model: "M5A", type: "vertical", name: "CENNETIC M5A Mold Vertical Machining Center", summary: S("The M5A is a mold-oriented vertical machining center balancing high-speed contouring with the rigidity needed for die and mold work.") },
    { pid: "277", slug: "1160-heavy-cut-vertical-machining-center", model: "1160", type: "vertical", name: "CENNETIC 1160 Heavy-Cut Vertical Machining Center", summary: S("The 1160 is a heavy-cut vertical machining center for large steel parts and mold bases, with a stiff column and wide table.") },
    { pid: "274", slug: "1165l-heavy-duty-vertical-machining-center", model: "1165L", type: "vertical", name: "CENNETIC 1165L Heavy-Duty Vertical Machining Center", summary: S("The 1165L is a heavy-duty vertical machining center engineered for aggressive material removal on large workpieces.") },
    { pid: "289", slug: "v1160l-two-line-one-hard-vertical-machining-center", model: "V1160L", type: "vertical", name: "CENNETIC V1160L High-Rigidity Vertical Machining Center", summary: S("The V1160L is a high-rigidity vertical machining center with an enlarged guideway layout for stable heavy machining and accurate finishing.") },
    { pid: "260", slug: "v850l-vertical-machining-center", model: "V850L", type: "vertical", name: "CENNETIC V850L Vertical Machining Center", summary: S("The V850L is a versatile 850 mm-travel vertical machining center for general-purpose milling of prismatic parts.") },
    { pid: "270", slug: "v856l-vertical-machining-center", model: "V856L", type: "vertical", name: "CENNETIC V856L Vertical Machining Center", summary: S("The V856L is a vertical machining center offering a wide table and strong Z-axis for mixed mold and part work.") },
    { pid: "294", slug: "w560l-dual-spindle-machining-center", model: "W560L", type: "vertical", name: "CENNETIC W560L High-Efficiency Machining Center", summary: S("The W560L is a high-efficiency, high-rigidity machining center designed for fast production cycles on steel and cast parts.") },
    { pid: "255", slug: "w650l-vertical-machining-center", model: "W650L", type: "vertical", name: "CENNETIC W650L Vertical Machining Center", summary: S("The W650L is a rigid vertical machining center for efficient roughing and finishing across a broad working range.") },

    // ——— 卧式 ———
    { pid: "275", slug: "hmc450-horizontal-machining-center", model: "HMC450", type: "horizontal", name: "CENNETIC HMC450 Horizontal Machining Center", summary: S("The HMC450 is a horizontal machining center for multi-face box-type parts, using a rotary table to machine four sides plus top in fewer setups.") },

    // ——— 钻攻 ———
    { pid: "281", slug: "t850-high-speed-drilling-tapping-center", model: "T850", type: "drilltap", name: "CENNETIC T850 High-Speed Drilling & Tapping Center", summary: S("The T850 is a high-speed drilling and tapping center for fast hole-making and light milling on aluminum and small steel parts in high-volume production.") },

    // ——— 车床 / 车铣复合 ———
    { pid: "292", slug: "sck52-400-cnc-lathe-turn-mill", model: "SCK52-400", type: "lathe", name: "CENNETIC SCK52-400 CNC Lathe / Turn-Mill Center", summary: S("The SCK52-400 is a CNC lathe with turn-mill capability for combined turning and milling of rotational parts in one chucking.") },
    { pid: "296", slug: "sck-46-52l-cnc-lathe", model: "SCK-46/52L", type: "lathe", name: "CENNETIC SCK-46/52L CNC Lathe", summary: S("The SCK-46/52L is a compact CNC lathe for efficient turning of small-to-medium rotational parts.") },
];
