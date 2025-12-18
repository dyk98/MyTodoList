import express from 'express';
import cors from 'cors';
import fse from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import multer from 'multer';
import { register, login, changePassword, generateInviteCode, authMiddleware, optionalAuthMiddleware, getUserDataDir, getUserDocsDir, DEMO_DATA_DIR, DEMO_DOCS_DIR, } from './auth.js';
const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3334;
// 项目根目录
const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
// 获取用户的 TODO 文件路径
function getTodoFilePath(userEmail, year) {
    if (!userEmail) {
        // 未登录用户使用 demo 数据
        return path.join(DEMO_DATA_DIR, `${year}-todo.md`);
    }
    return path.join(getUserDataDir(userEmail), `${year}-todo.md`);
}
// 获取用户的便利贴文件路径
function getNotesFilePath(userEmail) {
    if (!userEmail) {
        return path.join(DEMO_DATA_DIR, 'notes.json');
    }
    return path.join(getUserDataDir(userEmail), 'notes.json');
}
// 获取用户的 AI 对话历史文件路径
function getChatHistoryFilePath(userEmail) {
    if (!userEmail) {
        return path.join(DEMO_DATA_DIR, 'chat-history.json');
    }
    return path.join(getUserDataDir(userEmail), 'chat-history.json');
}
// 确保文件及其目录存在的辅助函数
async function ensureFileExists(filePath, defaultContent = '') {
    try {
        await fse.ensureFile(filePath);
        const stat = await fse.stat(filePath);
        if (stat.size === 0 && defaultContent) {
            await safeWriteFile(filePath, defaultContent);
        }
    }
    catch (error) {
        console.error(`Error ensuring file exists: ${filePath}`, error);
        throw error;
    }
}
// 安全读取文件（确保文件存在）
async function safeReadFile(filePath, defaultContent = '') {
    await ensureFileExists(filePath, defaultContent);
    return await fse.readFile(filePath, 'utf-8');
}
// 安全写入文件（确保目录存在）
async function safeWriteFile(filePath, content) {
    await fse.ensureDir(path.dirname(filePath));
    await fse.writeFile(filePath, content, 'utf-8');
}
// 获取用户的文档目录
function getDocsDir(userEmail) {
    if (!userEmail) {
        return DEMO_DOCS_DIR;
    }
    return getUserDocsDir(userEmail);
}
// ========== 统一的检测辅助函数 ==========
// 占位文本常量
const PLACEHOLDER_TEXT = '（暂无未完成任务）';
// 检测是否为分隔线
function isSeparator(line) {
    return line.trim() === '---';
}
// 检测是否为项目标题 (### xxx)
function isProjectHeader(line) {
    return line.startsWith('### ');
}
// 检测是否为周标题 (## X月X日 - X月X日)
function isWeekHeader(line) {
    return line.startsWith('## ') && /\d+月\d+日/.test(line);
}
// 检测是否为任务行
function isTaskLine(line) {
    return /^(\s*)- \[[ x]\]/.test(line);
}
// 检测是否为已完成任务
function isCompletedTask(line) {
    return /^(\s*)- \[x\]/.test(line);
}
// 检测是否为未完成任务
function isPendingTask(line) {
    return /^(\s*)- \[ \]/.test(line);
}
// 检测是否为占位文本
function isPlaceholder(line) {
    return line.trim() === PLACEHOLDER_TEXT;
}
// 检测是否为区块边界（分隔线或项目标题）
function isBlockBoundary(line) {
    return isSeparator(line) || isProjectHeader(line);
}
// 统一的错误处理函数
function handleError(res, error, context) {
    console.error(`[${context}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: errorMessage });
}
app.use(cors());
app.use(express.json());
// 配置 multer 用于文件上传（动态目录，在路由中处理）
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const authReq = req;
            const docsDir = getDocsDir(authReq.user?.email || null);
            cb(null, docsDir);
        },
        filename: (_req, file, cb) => {
            // 保留原文件名，使用 UTF-8 解码
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            cb(null, originalName);
        },
    }),
    fileFilter: (_req, file, cb) => {
        // 只允许上传 .md 文件
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        if (originalName.endsWith('.md')) {
            cb(null, true);
        }
        else {
            cb(new Error('只允许上传 .md 文件'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 限制
    },
});
// ========== 认证相关 API ==========
// 注册
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, inviteCode } = req.body;
        if (!email || !password || !inviteCode) {
            return res.status(400).json({ success: false, error: '邮箱、密码和邀请码都是必填项' });
        }
        const result = await register(email, password, inviteCode);
        if (result.success) {
            res.json({ success: true, token: result.token });
        }
        else {
            res.status(400).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        handleError(res, error, 'POST /api/auth/register');
    }
});
// 登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: '邮箱和密码都是必填项' });
        }
        const result = await login(email, password);
        if (result.success) {
            res.json({ success: true, token: result.token, isAdmin: result.isAdmin });
        }
        else {
            res.status(400).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        handleError(res, error, 'POST /api/auth/login');
    }
});
// 修改密码（需要登录）
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ success: false, error: '旧密码和新密码都是必填项' });
        }
        const result = await changePassword(req.user.email, oldPassword, newPassword);
        if (result.success) {
            res.json({ success: true });
        }
        else {
            res.status(400).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        handleError(res, error, 'POST /api/auth/change-password');
    }
});
// 获取当前用户信息（需要登录）
app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({
        success: true,
        user: {
            email: req.user.email,
            isAdmin: req.user.isAdmin,
        },
    });
});
// 生成邀请码（仅管理员）
app.post('/api/auth/invite', authMiddleware, async (req, res) => {
    try {
        const { targetEmail } = req.body;
        if (!targetEmail) {
            return res.status(400).json({ success: false, error: '目标邮箱是必填项' });
        }
        const result = await generateInviteCode(req.user.email, targetEmail);
        if (result.success) {
            res.json({ success: true, code: result.code });
        }
        else {
            res.status(400).json({ success: false, error: result.error });
        }
    }
    catch (error) {
        handleError(res, error, 'POST /api/auth/invite');
    }
});
// ========== TODO 相关 API（支持用户隔离）==========
// 获取可用年份列表
app.get('/api/years', optionalAuthMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || null;
        const dataDir = userEmail ? getUserDataDir(userEmail) : DEMO_DATA_DIR;
        const files = await fse.readdir(dataDir);
        const years = files
            .filter(f => /^\d{4}-todo\.md$/.test(f))
            .map(f => parseInt(f.slice(0, 4)))
            .sort((a, b) => b - a); // 降序，最新年份在前
        res.json({ success: true, years });
    }
    catch (error) {
        handleError(res, error, 'GET /api/years');
    }
});
// 获取 TODO 文件内容（支持年份参数）
app.get('/api/todo', optionalAuthMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || null;
        const year = req.query.year ? String(req.query.year) : new Date().getFullYear();
        const filePath = getTodoFilePath(userEmail, year);
        const content = await safeReadFile(filePath, `# ${year} TODO\n\n## 待办池\n\n---\n`);
        res.json({ success: true, content, year: Number(year), isDemo: !userEmail });
    }
    catch (error) {
        handleError(res, error, 'GET /api/todo');
    }
});
// 更新 TODO 文件内容（需要登录）
app.put('/api/todo', authMiddleware, async (req, res) => {
    try {
        const { content, year } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (typeof content !== 'string') {
            return res.status(400).json({ success: false, error: 'content is required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        await safeWriteFile(filePath, content);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, 'PUT /api/todo');
    }
});
// 切换任务完成状态（需要登录）
app.patch('/api/todo/toggle', authMiddleware, async (req, res) => {
    try {
        const { lineIndex, year } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (typeof lineIndex !== 'number') {
            return res.status(400).json({ success: false, error: 'lineIndex is required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        await ensureFileExists(filePath, `# ${targetYear} TODO\n\n## 待办池\n\n---\n`);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) {
            return res.status(400).json({ success: false, error: 'Invalid lineIndex' });
        }
        const line = lines[lineIndex];
        if (isPendingTask(line)) {
            lines[lineIndex] = line.replace('- [ ]', '- [x]');
        }
        else if (isCompletedTask(line)) {
            lines[lineIndex] = line.replace('- [x]', '- [ ]');
        }
        else {
            return res.status(400).json({ success: false, error: 'Line is not a todo item' });
        }
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'PATCH /api/todo/toggle');
    }
});
// 获取周列表（用于新增任务时选择时间段）
app.get('/api/weeks', optionalAuthMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || null;
        const year = req.query.year ? String(req.query.year) : new Date().getFullYear();
        const filePath = getTodoFilePath(userEmail, year);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        const weeks = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isWeekHeader(line)) {
                weeks.push({
                    title: line.slice(3).trim(),
                    lineIndex: i,
                });
            }
        }
        res.json({ success: true, weeks });
    }
    catch (error) {
        handleError(res, error, 'GET /api/weeks');
    }
});
// 新增任务（需要登录）
app.post('/api/todo/add', authMiddleware, async (req, res) => {
    try {
        const { task, project, year, weekLineIndex } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (!task || !project) {
            return res.status(400).json({ success: false, error: 'task and project are required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        let insertIndex = -1;
        // 如果指定了周，添加到周区块
        if (typeof weekLineIndex === 'number' && weekLineIndex >= 0) {
            // 找到周标题后，在项目下添加（如果周内有该项目分类）或直接添加到周内
            // 周区块内任务直接添加，不分项目
            for (let j = weekLineIndex + 1; j < lines.length; j++) {
                // 遇到下一个周标题或分隔线就停止
                if (isWeekHeader(lines[j]) || isSeparator(lines[j])) {
                    insertIndex = j;
                    break;
                }
            }
            if (insertIndex === -1) {
                insertIndex = lines.length;
            }
        }
        else {
            // 添加到待办池的对应项目下
            const projectHeader = `### ${project}`;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === projectHeader) {
                    // 检查是否有占位文本需要移除
                    let placeholderIndex = -1;
                    for (let j = i + 1; j < lines.length; j++) {
                        if (isPlaceholder(lines[j])) {
                            placeholderIndex = j;
                            break;
                        }
                        // 遇到边界或任务行就停止搜索
                        if (isBlockBoundary(lines[j]) || isTaskLine(lines[j])) {
                            break;
                        }
                    }
                    if (placeholderIndex !== -1) {
                        lines.splice(placeholderIndex, 1);
                    }
                    // 找到项目标题后，找下一个边界之前插入
                    for (let j = i + 1; j < lines.length; j++) {
                        if (isBlockBoundary(lines[j])) {
                            insertIndex = j;
                            break;
                        }
                        if (lines[j].trim() === '' && lines[j + 1] && isProjectHeader(lines[j + 1])) {
                            insertIndex = j;
                            break;
                        }
                    }
                    if (insertIndex === -1) {
                        insertIndex = i + 1;
                    }
                    break;
                }
            }
            if (insertIndex === -1) {
                return res.status(400).json({ success: false, error: 'Project not found' });
            }
        }
        // 插入新任务
        const newTask = `- [ ] ${task}`;
        lines.splice(insertIndex, 0, newTask);
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'POST /api/todo/add');
    }
});
// 新增子任务（需要登录）
app.post('/api/todo/add-subtask', authMiddleware, async (req, res) => {
    try {
        const { task, parentLineIndex, year } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (!task || typeof parentLineIndex !== 'number') {
            return res.status(400).json({ success: false, error: 'task and parentLineIndex are required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        if (parentLineIndex < 0 || parentLineIndex >= lines.length) {
            return res.status(400).json({ success: false, error: 'Invalid parentLineIndex' });
        }
        const parentLine = lines[parentLineIndex];
        if (!isTaskLine(parentLine)) {
            return res.status(400).json({ success: false, error: 'Parent line is not a todo item' });
        }
        // 计算父任务的缩进，子任务需要多缩进 4 个空格
        const parentIndent = parentLine.search(/\S/);
        const childIndent = ' '.repeat(parentIndent + 4);
        // 找到插入位置：父任务后面，在所有现有子任务之后
        let insertIndex = parentLineIndex + 1;
        for (let i = parentLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '') {
                // 跳过空行
                continue;
            }
            const currentIndent = line.search(/\S/);
            if (currentIndent <= parentIndent) {
                // 遇到同级或更高级的内容，在这里插入
                insertIndex = i;
                break;
            }
            // 继续往下找
            insertIndex = i + 1;
        }
        // 插入新子任务
        const newSubtask = `${childIndent}- [ ] ${task}`;
        lines.splice(insertIndex, 0, newSubtask);
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'POST /api/todo/add-subtask');
    }
});
// 新增分类（项目）（需要登录）
app.post('/api/project/add', authMiddleware, async (req, res) => {
    try {
        const { name, year } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (!name) {
            return res.status(400).json({ success: false, error: 'name is required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        // 检查是否已存在该分类
        const projectHeader = `### ${name}`;
        for (const line of lines) {
            if (line.trim() === projectHeader) {
                return res.status(400).json({ success: false, error: '分类已存在' });
            }
        }
        // 找到待办池中的 --- 分隔线位置，在其前插入新分类
        let separatorIndex = -1;
        let inPool = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '## 待办池') {
                inPool = true;
                continue;
            }
            if (inPool && isSeparator(line)) {
                separatorIndex = i;
                break;
            }
        }
        if (separatorIndex === -1) {
            return res.status(400).json({ success: false, error: '未找到待办池分隔线' });
        }
        // 在 --- 分隔线前插入新分类
        lines.splice(separatorIndex, 0, projectHeader, '', PLACEHOLDER_TEXT, '');
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'POST /api/project/add');
    }
});
// 删除任务（需要登录）
app.delete('/api/todo/delete', authMiddleware, async (req, res) => {
    try {
        const { lineIndex, year } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (typeof lineIndex !== 'number') {
            return res.status(400).json({ success: false, error: 'lineIndex is required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) {
            return res.status(400).json({ success: false, error: 'Invalid lineIndex' });
        }
        const line = lines[lineIndex];
        if (!isTaskLine(line)) {
            return res.status(400).json({ success: false, error: 'Line is not a todo item' });
        }
        // 收集要删除的行（任务及其子任务）
        const baseIndent = line.search(/\S/);
        const linesToDelete = [lineIndex];
        for (let i = lineIndex + 1; i < lines.length; i++) {
            const nextLine = lines[i];
            if (nextLine.trim() === '' || isBlockBoundary(nextLine)) {
                break;
            }
            const nextIndent = nextLine.search(/\S/);
            if (nextIndent > baseIndent) {
                linesToDelete.push(i);
            }
            else {
                break;
            }
        }
        // 从后往前删除，避免索引偏移
        for (let i = linesToDelete.length - 1; i >= 0; i--) {
            lines.splice(linesToDelete[i], 1);
        }
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'DELETE /api/todo/delete');
    }
});
// 编辑任务内容（需要登录）
app.patch('/api/todo/edit', authMiddleware, async (req, res) => {
    try {
        const { lineIndex, newContent, year } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (typeof lineIndex !== 'number' || typeof newContent !== 'string') {
            return res.status(400).json({ success: false, error: 'lineIndex and newContent are required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        if (lineIndex < 0 || lineIndex >= lines.length) {
            return res.status(400).json({ success: false, error: 'Invalid lineIndex' });
        }
        const line = lines[lineIndex];
        if (!isTaskLine(line)) {
            return res.status(400).json({ success: false, error: 'Line is not a todo item' });
        }
        // 保留原有的缩进和复选框状态
        const match = line.match(/^(\s*- \[[ x]\] )/);
        if (!match) {
            return res.status(400).json({ success: false, error: 'Invalid task format' });
        }
        lines[lineIndex] = match[1] + newContent.trim();
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'PATCH /api/todo/edit');
    }
});
// 任务排序：移动任务位置（需要登录）
app.post('/api/todo/reorder', authMiddleware, async (req, res) => {
    try {
        const { year, fromLineIndex, toLineIndex } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (typeof fromLineIndex !== 'number' || typeof toLineIndex !== 'number') {
            return res.status(400).json({ success: false, error: 'fromLineIndex and toLineIndex are required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        if (fromLineIndex < 0 || fromLineIndex >= lines.length || toLineIndex < 0 || toLineIndex >= lines.length) {
            return res.status(400).json({ success: false, error: 'Invalid line index' });
        }
        // 收集要移动的行（任务及其子任务）
        const fromLine = lines[fromLineIndex];
        const baseIndent = fromLine.search(/\S/);
        const linesToMove = [fromLine];
        // 收集子任务
        for (let i = fromLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line.trim() === '' || isBlockBoundary(line)) {
                break;
            }
            const indent = line.search(/\S/);
            if (indent > baseIndent) {
                linesToMove.push(line);
            }
            else {
                break;
            }
        }
        // 删除原位置的行
        lines.splice(fromLineIndex, linesToMove.length);
        // 计算新的插入位置（考虑删除后的偏移）
        let newToIndex = toLineIndex;
        if (toLineIndex > fromLineIndex) {
            newToIndex = toLineIndex - linesToMove.length;
        }
        // 插入到新位置
        lines.splice(newToIndex, 0, ...linesToMove);
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'POST /api/todo/reorder');
    }
});
// 辅助函数：获取某个日期所在周的周一
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}
// 辅助函数：格式化周标题
function formatWeekTitle(monday) {
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const format = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
    return `${format(monday)} - ${format(sunday)}`;
}
// 获取缩进层级（每 4 个空格 = 1 级）
function getIndentLevel(line) {
    const match = line.match(/^(\s*)/);
    return match ? Math.floor(match[1].length / 4) : 0;
}
// 构建任务树：扫描待办池，返回按项目分组的任务树
function buildTaskTreeFromPool(lines) {
    const projectTrees = new Map();
    let currentProject = '';
    let inPool = false;
    const stack = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // 检测待办池边界
        if (line.trim() === '## 待办池') {
            inPool = true;
            continue;
        }
        if (inPool && isSeparator(line)) {
            break; // 待办池结束
        }
        // 检测项目标题
        if (inPool && isProjectHeader(line)) {
            currentProject = line.slice(4).trim();
            stack.length = 0; // 清空栈
            if (!projectTrees.has(currentProject)) {
                projectTrees.set(currentProject, []);
            }
            continue;
        }
        // 跳过占位文本
        if (inPool && isPlaceholder(line)) {
            continue;
        }
        // 解析任务行
        if (inPool && isTaskLine(line)) {
            const indent = getIndentLevel(line);
            const completed = isCompletedTask(line);
            const meta = {
                lineIndex: i,
                indent,
                completed,
                originalLine: line,
                hasCompletedDescendants: false,
                hasIncompleteDescendants: false,
                shouldArchive: false,
                shouldDelete: false,
            };
            const node = { meta, children: [] };
            // 找到父节点（栈中最后一个缩进小于当前的节点）
            while (stack.length > 0 && stack[stack.length - 1].meta.indent >= indent) {
                stack.pop();
            }
            if (stack.length === 0) {
                // 根节点
                if (currentProject && projectTrees.has(currentProject)) {
                    projectTrees.get(currentProject).push(node);
                }
            }
            else {
                // 子节点
                const parent = stack[stack.length - 1];
                parent.children.push(node);
            }
            stack.push(node);
        }
    }
    return projectTrees;
}
// 递归标记任务状态（自底向上）
function markTaskStatus(node) {
    // 递归处理所有子节点
    for (const child of node.children) {
        markTaskStatus(child);
    }
    // 统计子节点状态
    let hasCompletedChild = false;
    let hasIncompleteChild = false;
    for (const child of node.children) {
        if (child.meta.completed || child.meta.hasCompletedDescendants) {
            hasCompletedChild = true;
        }
        if (!child.meta.completed || child.meta.hasIncompleteDescendants) {
            hasIncompleteChild = true;
        }
    }
    // 更新当前节点的后代状态
    node.meta.hasCompletedDescendants = node.meta.completed || hasCompletedChild;
    node.meta.hasIncompleteDescendants = hasIncompleteChild;
    // 决策：归档、删除
    if (node.meta.hasCompletedDescendants) {
        node.meta.shouldArchive = true; // 自己或后代有完成 → 需要归档
    }
    if (node.meta.completed && !node.meta.hasIncompleteDescendants) {
        node.meta.shouldDelete = true; // 自己完成且无未完成后代 → 完全删除
    }
}
// 构建归档内容（递归）
function buildArchiveLines(node, baseIndent) {
    const lines = [];
    if (!node.meta.shouldArchive) {
        return lines;
    }
    // 计算当前行的缩进
    const indentStr = '    '.repeat(baseIndent);
    // 父任务在归档中显示为 [x]
    const taskContent = node.meta.originalLine.trim().replace(/^- \[.\]/, '- [x]');
    lines.push(indentStr + taskContent);
    // 递归处理子节点
    for (const child of node.children) {
        if (child.meta.completed || child.meta.hasCompletedDescendants) {
            // 已完成或有已完成后代 → 继续归档
            lines.push(...buildArchiveLines(child, baseIndent + 1));
        }
    }
    return lines;
}
// 构建待办池保留内容（递归）
function buildRetainedLines(node) {
    const lines = [];
    if (node.meta.shouldDelete) {
        return []; // 完全删除，不返回任何内容
    }
    // 保留父任务（强制改为 [ ]）
    const taskContent = node.meta.originalLine.replace(/^(\s*)- \[.\]/, '$1- [ ]');
    lines.push(taskContent);
    // 递归保留未完成的子任务
    for (const child of node.children) {
        if (!child.meta.shouldDelete) {
            lines.push(...buildRetainedLines(child));
        }
    }
    return lines;
}
// 替换待办池内容
function replacePoolInLines(lines, newPoolContent) {
    let poolStartIndex = -1;
    let poolEndIndex = -1;
    // 找到待办池的起始和结束位置
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '## 待办池') {
            poolStartIndex = i;
        }
        if (poolStartIndex !== -1 && isSeparator(lines[i])) {
            poolEndIndex = i;
            break;
        }
    }
    if (poolStartIndex === -1) {
        throw new Error('找不到待办池区域');
    }
    // 删除旧的待办池内容（保留分隔线）
    const result = [
        ...lines.slice(0, poolStartIndex),
        ...newPoolContent,
        ...lines.slice(poolEndIndex),
    ];
    return result;
}
// 周结算：将待办池中已完成的任务移动到当前周区块（需要登录）
app.post('/api/todo/week-settle', authMiddleware, async (req, res) => {
    try {
        const { year } = req.body;
        const targetYear = year || new Date().getFullYear();
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        let lines = content.split('\n');
        // ========== 新算法：阶段 1 - 构建任务树 ==========
        const projectTrees = buildTaskTreeFromPool(lines);
        if (projectTrees.size === 0) {
            return res.status(400).json({ success: false, error: '待办池为空' });
        }
        // ========== 阶段 2 - 递归标记所有任务 ==========
        let hasArchivableContent = false;
        for (const roots of projectTrees.values()) {
            for (const root of roots) {
                markTaskStatus(root);
                if (root.meta.shouldArchive) {
                    hasArchivableContent = true;
                }
            }
        }
        if (!hasArchivableContent) {
            return res.status(400).json({ success: false, error: '没有已完成的任务需要结算' });
        }
        // ========== 阶段 3 - 构建归档内容（用于周区块） ==========
        const archiveContents = [];
        for (const [projectName, roots] of projectTrees) {
            const projectArchiveLines = [];
            for (const root of roots) {
                if (root.meta.shouldArchive) {
                    // baseIndent = 0 因为还没加项目名缩进
                    projectArchiveLines.push(...buildArchiveLines(root, 0));
                }
            }
            if (projectArchiveLines.length > 0) {
                archiveContents.push({
                    projectName,
                    lines: projectArchiveLines,
                });
            }
        }
        // ========== 阶段 4 - 重建待办池（保留未完成任务） ==========
        const newPoolLines = ['## 待办池', ''];
        for (const [projectName, roots] of projectTrees) {
            const projectRetainedLines = [];
            for (const root of roots) {
                if (!root.meta.shouldDelete) {
                    projectRetainedLines.push(...buildRetainedLines(root));
                }
            }
            newPoolLines.push(`### ${projectName}`);
            if (projectRetainedLines.length === 0) {
                newPoolLines.push(PLACEHOLDER_TEXT, '');
            }
            else {
                newPoolLines.push(...projectRetainedLines, '');
            }
        }
        newPoolLines.push(''); // 末尾空行
        // 将归档内容转换为旧格式（兼容后续代码）
        const completedTasks = archiveContents.map(ac => ({
            projectName: ac.projectName,
            lines: ac.lines,
        }));
        // ========== 阶段 5 - 确定或创建周区块（保持原有逻辑） ==========
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // 查找所有周区块（包含开始和结束日期信息）
        const weekBlocks = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (isWeekHeader(line)) {
                const title = line.slice(3).trim();
                const match = title.match(/(\d+)月(\d+)日\s*-\s*(\d+)月(\d+)日/);
                if (match) {
                    const [, startMonth, startDay, endMonth, endDay] = match;
                    const year = new Date().getFullYear();
                    const startDate = new Date(year, parseInt(startMonth) - 1, parseInt(startDay));
                    const endDate = new Date(year, parseInt(endMonth) - 1, parseInt(endDay));
                    weekBlocks.push({ title, lineIndex: i, startDate, endDate });
                }
            }
        }
        // 5. 找到待办池后的第一个 --- 位置（插入新周区块的位置）
        let insertPosition = -1;
        for (let i = 0; i < lines.length; i++) {
            if (isSeparator(lines[i])) {
                insertPosition = i + 1;
                break;
            }
        }
        if (insertPosition === -1) {
            insertPosition = lines.length;
        }
        // 6. 检查是否需要创建新的周区块
        let currentWeekLineIndex;
        let currentWeekTitle;
        if (weekBlocks.length === 0) {
            // 没有任何周区块，创建包含今天的周（从今天开始的 7 天）
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const format = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
            currentWeekTitle = `${format(today)} - ${format(weekEnd)}`;
            const newWeekBlock = ['', '---', '', `## ${currentWeekTitle}`, ''];
            lines.splice(insertPosition, 0, ...newWeekBlock);
            currentWeekLineIndex = insertPosition + 3; // ## 行的位置
        }
        else {
            // 检查今天是否落在某个已存在的周区块内
            const existingWeek = weekBlocks.find(w => today >= w.startDate && today <= w.endDate);
            if (existingWeek) {
                currentWeekLineIndex = existingWeek.lineIndex;
                currentWeekTitle = existingWeek.title;
            }
            else {
                // 今天不在任何已存在的周区块内，需要创建新的周区块
                const latestWeek = weekBlocks[0]; // 按文件顺序，第一个是最新的
                const weeksToCreate = [];
                // 从最新周结束日期的下一天开始，创建到包含今天的周
                const nextStart = new Date(latestWeek.endDate);
                nextStart.setDate(nextStart.getDate() + 1);
                while (nextStart <= today) {
                    // 创建从 nextStart 开始的 7 天周区块
                    const weekEnd = new Date(nextStart);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    const format = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
                    weeksToCreate.push(`${format(nextStart)} - ${format(weekEnd)}`);
                    nextStart.setDate(nextStart.getDate() + 7);
                }
                // 按时间倒序插入（最新的在最前面）
                weeksToCreate.reverse();
                // 在待办池 --- 后插入新周区块
                const newWeekLines = [];
                for (const weekTitle of weeksToCreate) {
                    newWeekLines.push('', '---', '', `## ${weekTitle}`, '');
                }
                lines.splice(insertPosition, 0, ...newWeekLines);
                // 当前周是第一个插入的（最新的那个）
                currentWeekLineIndex = insertPosition + 3;
                currentWeekTitle = weeksToCreate[0];
            }
        }
        // 7. 重新扫描找到当前周的位置（因为可能插入了新行）
        for (let i = 0; i < lines.length; i++) {
            if (lines[i] === `## ${currentWeekTitle}`) {
                currentWeekLineIndex = i;
                break;
            }
        }
        // 8. 找到当前周区块的结束位置（下一个 --- 或周标题或文件结尾）
        let weekEndIndex = lines.length;
        for (let i = currentWeekLineIndex + 1; i < lines.length; i++) {
            if (isSeparator(lines[i]) || isWeekHeader(lines[i])) {
                weekEndIndex = i;
                break;
            }
        }
        // 9. 构建要插入的任务内容
        const tasksByProject = {};
        for (const task of completedTasks) {
            if (!tasksByProject[task.projectName]) {
                tasksByProject[task.projectName] = [];
            }
            tasksByProject[task.projectName].push(...task.lines);
        }
        // 10. 扫描当前周区块中已存在的项目分类，合并而非重复创建
        // 周区块中的项目格式为 "- [x] 项目名"
        const existingProjects = [];
        for (let i = currentWeekLineIndex + 1; i < weekEndIndex; i++) {
            const line = lines[i];
            // 匹配一级任务格式 "- [x] 项目名"（无前导空格）
            const match = line.match(/^- \[x\] (.+)$/);
            if (match) {
                const projectName = match[1];
                // 找到这个项目分类的结束位置（下一个同级任务或区块结束）
                let projectEndIndex = i + 1;
                for (let j = i + 1; j < weekEndIndex; j++) {
                    const nextLine = lines[j];
                    // 如果遇到另一个一级任务（无缩进的 - [x]），结束
                    if (nextLine.match(/^- \[x\] .+$/)) {
                        projectEndIndex = j;
                        break;
                    }
                    // 如果是子任务（有缩进），继续
                    if (nextLine.match(/^\s+- \[.?\]/) || nextLine.match(/^\s+\S/)) {
                        projectEndIndex = j + 1;
                        continue;
                    }
                    // 空行，继续
                    if (nextLine.trim() === '') {
                        projectEndIndex = j + 1;
                        continue;
                    }
                    // 其他情况（如分隔线），结束
                    projectEndIndex = j;
                    break;
                }
                existingProjects.push({ name: projectName, endLineIndex: projectEndIndex });
            }
        }
        // 11. 分类合并：已存在的分类追加到末尾，新分类添加到周区块末尾
        const projectsToAddAtEnd = []; // 需要在周区块末尾新建的项目
        const insertions = []; // 需要在现有项目末尾插入的内容
        for (const projectName of Object.keys(tasksByProject)) {
            const tasks = tasksByProject[projectName];
            if (projectName) {
                // 查找是否已存在该分类
                const existing = existingProjects.find(p => p.name === projectName);
                if (existing) {
                    // 已存在，在该分类末尾追加任务
                    // 保留原有层级结构，计算最小缩进并在此基础上增加 4 空格
                    const minIndent = Math.min(...tasks.map((t) => t.search(/\S/)).filter((n) => n >= 0));
                    const linesToInsert = tasks.map((taskLine) => {
                        const currentIndent = taskLine.search(/\S/);
                        const relativeIndent = currentIndent >= 0 ? currentIndent - minIndent : 0;
                        return '    ' + ' '.repeat(relativeIndent) + taskLine.trim();
                    });
                    insertions.push({ index: existing.endLineIndex, lines: linesToInsert });
                    // 更新后续项目的 endLineIndex（因为插入了新行）
                    const insertCount = linesToInsert.length;
                    for (const p of existingProjects) {
                        if (p.endLineIndex >= existing.endLineIndex) {
                            p.endLineIndex += insertCount;
                        }
                    }
                    weekEndIndex += insertCount;
                }
                else {
                    // 不存在，需要在周区块末尾新建
                    projectsToAddAtEnd.push(projectName);
                }
            }
            else {
                // 无项目名的任务，直接添加到末尾
                projectsToAddAtEnd.push('');
            }
        }
        // 按索引从大到小排序，从后往前插入避免索引偏移
        insertions.sort((a, b) => b.index - a.index);
        for (const insertion of insertions) {
            lines.splice(insertion.index, 0, ...insertion.lines);
        }
        // 重新计算 weekEndIndex（因为可能有插入）
        weekEndIndex = lines.length;
        for (let i = currentWeekLineIndex + 1; i < lines.length; i++) {
            if (isSeparator(lines[i]) || isWeekHeader(lines[i])) {
                weekEndIndex = i;
                break;
            }
        }
        // 在周区块末尾添加新项目分类
        const newProjectLines = [];
        for (const projectName of projectsToAddAtEnd) {
            const tasks = tasksByProject[projectName];
            if (projectName) {
                newProjectLines.push(`- [x] ${projectName}`);
                // 保留原有层级结构，计算最小缩进并在此基础上增加 4 空格
                const minIndent = Math.min(...tasks.map((t) => t.search(/\S/)).filter((n) => n >= 0));
                for (const taskLine of tasks) {
                    const currentIndent = taskLine.search(/\S/);
                    const relativeIndent = currentIndent >= 0 ? currentIndent - minIndent : 0;
                    newProjectLines.push('    ' + ' '.repeat(relativeIndent) + taskLine.trim());
                }
            }
            else {
                // 无项目名的任务，保留原有层级结构
                const minIndent = Math.min(...tasks.map((t) => t.search(/\S/)).filter((n) => n >= 0));
                for (const taskLine of tasks) {
                    const currentIndent = taskLine.search(/\S/);
                    const relativeIndent = currentIndent >= 0 ? currentIndent - minIndent : 0;
                    newProjectLines.push(' '.repeat(relativeIndent) + taskLine.trim());
                }
            }
        }
        if (newProjectLines.length > 0) {
            lines.splice(weekEndIndex, 0, ...newProjectLines, '');
        }
        // ========== 阶段 6 - 替换待办池内容 ==========
        lines = replacePoolInLines(lines, newPoolLines);
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({
            success: true,
            newContent: lines.join('\n'),
            settledCount: completedTasks.length,
            weekTitle: currentWeekTitle
        });
    }
    catch (error) {
        handleError(res, error, 'POST /api/todo/week-settle');
    }
});
// 获取文档列表（支持用户隔离）
app.get('/api/docs', optionalAuthMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || null;
        const docsDir = getDocsDir(userEmail);
        // 确保 docs 目录存在（兼容旧用户）
        await fse.mkdir(docsDir, { recursive: true });
        const files = await fse.readdir(docsDir);
        const docs = files
            .filter(f => f.endsWith('.md'))
            .map(f => ({
            name: f.replace('.md', ''),
            filename: f,
        }));
        res.json({ success: true, docs, isDemo: !userEmail });
    }
    catch (error) {
        handleError(res, error, 'GET /api/docs');
    }
});
// 获取文档内容（支持用户隔离）
app.get('/api/docs/:filename', optionalAuthMiddleware, async (req, res) => {
    try {
        const { filename } = req.params;
        // 安全检查：防止路径遍历
        if (filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ success: false, error: 'Invalid filename' });
        }
        const userEmail = req.user?.email || null;
        const docsDir = getDocsDir(userEmail);
        const filePath = path.join(docsDir, filename);
        const content = await safeReadFile(filePath);
        res.json({ success: true, content });
    }
    catch (error) {
        handleError(res, error, 'GET /api/docs/:filename');
    }
});
// 上传文档（需要登录）
app.post('/api/docs/upload', authMiddleware, upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: '没有上传文件' });
        }
        const filename = req.file.filename;
        res.json({
            success: true,
            filename,
            name: filename.replace('.md', ''),
        });
    }
    catch (error) {
        handleError(res, error, 'POST /api/docs/upload');
    }
});
// 新增周区块（需要登录）
app.post('/api/week/add', authMiddleware, async (req, res) => {
    try {
        const { year, weekTitle } = req.body;
        const targetYear = year || new Date().getFullYear();
        if (!weekTitle) {
            return res.status(400).json({ success: false, error: 'weekTitle is required' });
        }
        const filePath = getTodoFilePath(req.user.email, targetYear);
        const content = await safeReadFile(filePath);
        const lines = content.split('\n');
        // 检查周区块是否已存在（使用精确匹配）
        const targetWeekHeader = `## ${weekTitle}`;
        for (const line of lines) {
            if (line.trim() === targetWeekHeader) {
                return res.status(400).json({ success: false, error: '该周区块已存在' });
            }
        }
        // 找到待办池后的第一个 --- 位置
        let insertPosition = -1;
        for (let i = 0; i < lines.length; i++) {
            if (isSeparator(lines[i])) {
                insertPosition = i + 1;
                break;
            }
        }
        if (insertPosition === -1) {
            insertPosition = lines.length;
        }
        // 插入新周区块
        const newWeekBlock = ['', '---', '', `## ${weekTitle}`, ''];
        lines.splice(insertPosition, 0, ...newWeekBlock);
        await safeWriteFile(filePath, lines.join('\n'));
        res.json({ success: true, newContent: lines.join('\n') });
    }
    catch (error) {
        handleError(res, error, 'POST /api/week/add');
    }
});
// AI 聊天接口 - 使用 claude CLI（支持用户隔离工作空间）
app.post('/api/ai/chat', optionalAuthMiddleware, async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: 'message is required' });
        }
        // 确定工作目录：登录用户使用个人目录，未登录使用 demo 目录
        const userEmail = req.user?.email || null;
        const workDir = userEmail ? getUserDataDir(userEmail) : DEMO_DATA_DIR;
        // 构建包含历史的 prompt
        // 只取最近 5 条对话（10 条消息）
        const recentHistory = history.slice(-10);
        let fullPrompt = '';
        if (recentHistory.length > 0) {
            fullPrompt += '以下是之前的对话历史：\n\n';
            for (const msg of recentHistory) {
                const roleLabel = msg.role === 'user' ? '用户' : '助手';
                fullPrompt += `${roleLabel}: ${msg.content}\n\n`;
            }
            fullPrompt += '---\n\n现在用户说：\n\n';
        }
        fullPrompt += message;
        // 使用 claude CLI 执行任务
        // --print 模式直接输出结果
        // --allowedTools 限制可用工具为 Read 和 Edit
        // --permission-mode acceptEdits 自动接受编辑
        const escapedMessage = fullPrompt.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
        const command = `claude -p "${escapedMessage}" --allowedTools "Read,Edit" --permission-mode acceptEdits`;
        console.log('Executing claude command with history, message length:', fullPrompt.length, 'workDir:', workDir);
        const result = execSync(command, {
            cwd: workDir,
            encoding: 'utf-8',
            timeout: 120000, // 2 分钟超时
            maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            env: {
                ...process.env, // 继承当前进程的所有环境变量
                HOME: process.env.HOME || require('os').homedir(), // 确保 HOME 环境变量存在
            },
        });
        res.json({ success: true, reply: result.trim() });
    }
    catch (error) {
        handleError(res, error, 'POST /api/ai/chat');
    }
});
// ========== 便利贴相关 API ==========
// 获取所有便利贴
app.get('/api/notes', optionalAuthMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || null;
        const notesPath = getNotesFilePath(userEmail);
        try {
            const content = await safeReadFile(notesPath);
            const notes = JSON.parse(content);
            res.json({ success: true, notes, isDemo: !userEmail });
        }
        catch (error) {
            // 文件不存在或解析失败，返回空数组
            res.json({ success: true, notes: [], isDemo: !userEmail });
        }
    }
    catch (error) {
        handleError(res, error, 'GET /api/notes');
    }
});
// 创建便利贴
app.post('/api/notes', authMiddleware, async (req, res) => {
    try {
        const { title, content, color } = req.body;
        if (!title) {
            return res.status(400).json({ success: false, error: 'title is required' });
        }
        const userEmail = req.user.email;
        const notesPath = getNotesFilePath(userEmail);
        // 读取现有便利贴
        let notes = [];
        try {
            const fileContent = await safeReadFile(notesPath);
            notes = JSON.parse(fileContent);
        }
        catch {
            // 文件不存在，从空数组开始
            notes = [];
        }
        // 创建新便利贴
        const now = new Date().toISOString();
        const newNote = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            title: title || '无标题',
            content: content || '',
            color: color || 'yellow',
            createdAt: now,
            updatedAt: now,
        };
        notes.push(newNote);
        await fse.writeFile(notesPath, JSON.stringify(notes, null, 2), 'utf-8');
        res.json({ success: true, note: newNote });
    }
    catch (error) {
        handleError(res, error, 'POST /api/notes');
    }
});
// 更新便利贴
app.put('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, color } = req.body;
        const userEmail = req.user.email;
        const notesPath = getNotesFilePath(userEmail);
        const fileContent = await safeReadFile(notesPath);
        const notes = JSON.parse(fileContent);
        const noteIndex = notes.findIndex((n) => n.id === id);
        if (noteIndex === -1) {
            return res.status(404).json({ success: false, error: 'Note not found' });
        }
        // 更新便利贴
        if (title !== undefined)
            notes[noteIndex].title = title;
        if (content !== undefined)
            notes[noteIndex].content = content;
        if (color !== undefined)
            notes[noteIndex].color = color;
        notes[noteIndex].updatedAt = new Date().toISOString();
        await fse.writeFile(notesPath, JSON.stringify(notes, null, 2), 'utf-8');
        res.json({ success: true, note: notes[noteIndex] });
    }
    catch (error) {
        handleError(res, error, 'PUT /api/notes/:id');
    }
});
// 删除便利贴
app.delete('/api/notes/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;
        const notesPath = getNotesFilePath(userEmail);
        const fileContent = await safeReadFile(notesPath);
        let notes = JSON.parse(fileContent);
        const originalLength = notes.length;
        notes = notes.filter((n) => n.id !== id);
        if (notes.length === originalLength) {
            return res.status(404).json({ success: false, error: 'Note not found' });
        }
        await fse.writeFile(notesPath, JSON.stringify(notes, null, 2), 'utf-8');
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, 'DELETE /api/notes/:id');
    }
});
// 获取所有对话历史
app.get('/api/chat-history', optionalAuthMiddleware, async (req, res) => {
    try {
        const userEmail = req.user?.email || null;
        const historyPath = getChatHistoryFilePath(userEmail);
        try {
            const content = await safeReadFile(historyPath);
            const sessions = JSON.parse(content);
            res.json({ success: true, sessions });
        }
        catch (error) {
            // 文件不存在或解析失败，返回空数组
            res.json({ success: true, sessions: [] });
        }
    }
    catch (error) {
        handleError(res, error, 'GET /api/chat-history');
    }
});
// 保存对话会话
app.post('/api/chat-history', optionalAuthMiddleware, async (req, res) => {
    try {
        const { session } = req.body;
        if (!session || !session.id || !session.messages) {
            return res.status(400).json({ success: false, error: 'Invalid session data' });
        }
        const userEmail = req.user?.email || null;
        const historyPath = getChatHistoryFilePath(userEmail);
        // 读取现有历史
        let sessions = [];
        try {
            const content = await safeReadFile(historyPath);
            sessions = JSON.parse(content);
        }
        catch {
            // 文件不存在，使用空数组
        }
        // 检查是否已存在该会话
        const existingIndex = sessions.findIndex((s) => s.id === session.id);
        if (existingIndex >= 0) {
            // 更新现有会话
            sessions[existingIndex] = session;
        }
        else {
            // 添加新会话到开头
            sessions.unshift(session);
        }
        // 限制最多保存 100 个会话
        if (sessions.length > 100) {
            sessions = sessions.slice(0, 100);
        }
        await fse.writeFile(historyPath, JSON.stringify(sessions, null, 2), 'utf-8');
        res.json({ success: true, session });
    }
    catch (error) {
        handleError(res, error, 'POST /api/chat-history');
    }
});
// 删除对话会话
app.delete('/api/chat-history/:id', optionalAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userEmail = req.user?.email || null;
        const historyPath = getChatHistoryFilePath(userEmail);
        const fileContent = await safeReadFile(historyPath);
        let sessions = JSON.parse(fileContent);
        const originalLength = sessions.length;
        sessions = sessions.filter((s) => s.id !== id);
        if (sessions.length === originalLength) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }
        await fse.writeFile(historyPath, JSON.stringify(sessions, null, 2), 'utf-8');
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, 'DELETE /api/chat-history/:id');
    }
});
// 数据目录（用于日志输出）
const DATA_DIR = path.resolve(import.meta.dirname, '../data');
// 生产环境：提供前端静态文件
if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(PROJECT_ROOT, 'dist');
    console.log(`Serving static files from: ${distPath}`);
    // 提供静态文件
    app.use(express.static(distPath));
    // 所有非 API 路由返回 index.html（支持前端路由）
    app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Data directory: ${DATA_DIR}`);
});
