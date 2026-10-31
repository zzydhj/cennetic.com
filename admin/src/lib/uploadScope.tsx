/**
 * 「当前正在为哪条内容上传图片」的上下文。
 *
 * 为什么用 context 而不是传 prop：上传动作发生在 ImageField 里，而它被嵌在
 * FieldControl → SectionCard → ResourceEdit 三层之下。把 scope 一路传下去要改
 * 每一层的签名，那些层本身并不关心这个值 —— 典型的 prop 钻透。
 *
 * 它的唯一用途是让服务端把归属编进对象键名（见 functions/api/media/upload.ts），
 * 避免出现 uploads/2026/10/gs9alg-6.webp 这种看不出是谁的哑巴文件名。
 */
import { createContext, useContext } from 'react';

const UploadScopeContext = createContext<string>('');

export const UploadScopeProvider = UploadScopeContext.Provider;

/** 没有 Provider 时返回空串，服务端会退回「原文件名 + 时间」，不影响上传成功 */
export function useUploadScope(): string {
    return useContext(UploadScopeContext);
}
