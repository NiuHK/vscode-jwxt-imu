// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const puppeteer = require('puppeteer');
const path = require('path');
const { getScores } = require('./getScores');
const { checkLogin } = require('./checkLogin');
const { updateSchedule } = require('./updateSchedule');

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	

	const headersFilePath = path.join(context.globalStoragePath, 'headers.json');
	const cookiesFilePath = path.join(context.globalStoragePath, 'cookies.json');
	const scoresFilePath = path.join(context.globalStoragePath, 'scores.json');
	const personalInfoFilePath = path.join(context.globalStoragePath, 'personalInfo.json');
	const credentialsFilePath = path.join(context.globalStoragePath, 'credentials.json');
	const scheduleFilePath = path.join(context.globalStoragePath, 'schedule.json');

	// 确保存储路径存在
	if (!fs.existsSync(context.globalStoragePath)) {
		fs.mkdirSync(context.globalStoragePath, { recursive: true });
	}

	if (!fs.existsSync(headersFilePath) || !fs.existsSync(cookiesFilePath)) {
		await loginAndSaveHeadersAndCookies(headersFilePath, cookiesFilePath, credentialsFilePath);
		
	}

	// 注册查看 cookie 的命令
	const viewCookiesDisposable = vscode.commands.registerCommand('jwxt.viewCookies', function () {
		if (fs.existsSync(cookiesFilePath)) {
			const cookies = fs.readFileSync(cookiesFilePath, 'utf8');
			vscode.window.showInformationMessage(` ${cookies}`);
		} else {
			vscode.window.showInformationMessage('No cookies found.');
		}
	});

	context.subscriptions.push(viewCookiesDisposable);

	// 注册获取成绩的命令
	const getScoresDisposable = vscode.commands.registerCommand('jwxt.getScores', async function () {
		try {

			const scores = await getScores(cookiesFilePath);
			vscode.window.showInformationMessage(`成绩获取成功`);

			// 更新 TreeView
			scoresProvider.setScores(scores);

			// 持久化成绩数据
			fs.writeFileSync(scoresFilePath, JSON.stringify(scores));
		} catch (error) {
			console.error('课程获取失败:', error);
			vscode.window.showErrorMessage('课程获取失败，请检查日志。');
		}
	});

	context.subscriptions.push(getScoresDisposable);

	// 注册登录并保存 cookie 和 headers 的命令
	const loginDisposable = vscode.commands.registerCommand('jwxt.login', async function () {
		if (!fs.existsSync(credentialsFilePath)) {
			await vscode.commands.executeCommand('jwxt.setCredentials');
		}
		await loginAndSaveHeadersAndCookies(headersFilePath, cookiesFilePath, credentialsFilePath);
		vscode.window.showInformationMessage('登录成功');
	});

	context.subscriptions.push(loginDisposable);

	// 注册 CheckLogin 命令
	const checkLoginDisposable = vscode.commands.registerCommand('jwxt.checkLogin', async function () {
		const personalInfo = await checkLogin(cookiesFilePath);
		if (personalInfo && Object.keys(personalInfo).length > 0 && personalInfo.name) {
			personalInfoProvider.setPersonalInfo(personalInfo);
			fs.writeFileSync(personalInfoFilePath, JSON.stringify(personalInfo));
			// vscode.window.showInformationMessage('个人信息获取成功');
			//同步更新信息
			await vscode.commands.executeCommand('jwxt.getScores');
			
		} else {
			vscode.window.showErrorMessage('未登录或获取个人信息失败');
		}
	});

	context.subscriptions.push(checkLoginDisposable);

	// 注册设置账号密码或导入 cookies 的命令
	const setCredentialsDisposable = vscode.commands.registerCommand('jwxt.setCredentials', async function () {
		const options = ['账号密码', 'Cookies 导入'];
		const choice = await vscode.window.showQuickPick(options, { placeHolder: '请选择设置方式' });

		if (choice === '账号密码') {
			const username = await vscode.window.showInputBox({ prompt: '请输入账号' });
			const password = await vscode.window.showInputBox({ prompt: '请输入密码', password: true });

			if (username && password) {
				const credentials = { username, password };
				fs.writeFileSync(credentialsFilePath, JSON.stringify(credentials));
				vscode.window.showInformationMessage('账号密码设置成功');
			} else {
				vscode.window.showErrorMessage('账号或密码不能为空');
			}
		} else if (choice === 'Cookies 导入') {
			const cookiesInput = await vscode.window.showInputBox({ prompt: '请输入 JSON 格式的 cookies' });

			if (cookiesInput) {
				try {
					const cookies = JSON.parse(cookiesInput);
					fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies));
					vscode.window.showInformationMessage('Cookies 设置成功');
				} catch (error) {
					vscode.window.showErrorMessage('无效的 JSON 格式');
				}
			} else {
				vscode.window.showErrorMessage('Cookies 不能为空');
			}
		}
	});

	context.subscriptions.push(setCredentialsDisposable);

	// 注册 TreeView 提供者
	const scoresProvider = new ScoresProvider();
	vscode.window.registerTreeDataProvider('gradesView', scoresProvider);

	// 注册个人信息视图的数据提供者
	const personalInfoProvider = new PersonalInfoProvider();
	vscode.window.registerTreeDataProvider('personalInfoView', personalInfoProvider);

	// 加载持久化的成绩数据
	if (fs.existsSync(scoresFilePath)) {
		const savedScores = JSON.parse(fs.readFileSync(scoresFilePath, 'utf8'));
		scoresProvider.setScores(savedScores);
	}

	// 加载持久化的个人信息数据
	if (fs.existsSync(personalInfoFilePath)) {
		const savedPersonalInfo = JSON.parse(fs.readFileSync(personalInfoFilePath, 'utf8'));
		personalInfoProvider.setPersonalInfo(savedPersonalInfo);
	}

	// 注册更新课表的命令
	const updateScheduleDisposable = vscode.commands.registerCommand('jwxt.updateSchedule', async function () {
		try {
			const schedule = await updateSchedule(cookiesFilePath);
			if (schedule != null) {
				// 更新 TreeView 或其他视图
				scheduleProvider.setSchedule(schedule.classList);
				vscode.window.showInformationMessage('课表更新成功');

				// 持久化课表数据
				fs.writeFileSync(scheduleFilePath, JSON.stringify(schedule));
			} else {
				vscode.window.showErrorMessage('课表为空，更新失败');
			}
		} catch (error) {
			console.error('课表更新失败:', error);
			vscode.window.showErrorMessage('课表更新失败，请检查日志。');
		}
	});

	context.subscriptions.push(updateScheduleDisposable);

	// 注册课表视图的数据提供者
	const scheduleProvider = new ScheduleProvider();
	vscode.window.registerTreeDataProvider('scheduleView', scheduleProvider);

	// 加载持久化的课表数据
	if (fs.existsSync(scheduleFilePath)) {
		const savedSchedule = JSON.parse(fs.readFileSync(scheduleFilePath, 'utf8'));
		scheduleProvider.setSchedule(savedSchedule.classList);
	}

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('jwxt.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from jwxt!');
	});

	context.subscriptions.push(disposable);
}

// TreeView 数据提供者
class ScoresProvider {
	constructor() {
		this.scores = [];
	}

	setScores(scores) {
		this.scores = scores;
		this.sortScores();
		this._onDidChangeTreeData.fire();
	}

	sortScores() {
		this.scores.sort((a, b) => {
			if (a.academicYearCode > b.academicYearCode) {
				return -1;
			}
			if (a.academicYearCode < b.academicYearCode) {
				return 1;
			}
			return 0;
		});
	}

	getTreeItem(element) {
		if (element.children) {
			const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
			treeItem.contextValue = JSON.stringify(element.children);
			treeItem.description = `绩点: ${element.PointScore}`;
			return treeItem;
		} else {
			return new vscode.TreeItem(element.label);
		}
	}

	getChildren(element) {
		if (element) {
			return element.children.map(child => new vscode.TreeItem(child.label));
		} else {
			return this.scores.map(score => {
				return {
					label: score.courseName,
					PointScore: score.gradePointScore,
					children: [
						{ label: `学年学期: ${score.academicYearCode}` },
						{ label: `课程属性: ${score.courseAttributeName}` },
						{ label: `学分: ${score.credit}` },
						{ label: `成绩: ${score.cj}` },
						{ label: `绩点: ${score.gradePointScore}` }
					]
				};
			});
		}
	}

	get onDidChangeTreeData() {
		return this._onDidChangeTreeData.event;
	}

	_onDidChangeTreeData = new vscode.EventEmitter();
}

// 个人信息视图的数据提供者
class PersonalInfoProvider {
	constructor() {
		this.personalInfo = {};
	}

	setPersonalInfo(info) {
		this.personalInfo ={
			姓名: info.name,
			学号: info.studentId,
			班级: info.class,
			当前GPA: info.GPA,
			最后登录时间: info.lastLogin
		};
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		return new vscode.TreeItem(element.label);
	}

	getChildren() {
		return Object.keys(this.personalInfo).map(key => {
			return { label: `${key}: ${this.personalInfo[key]}` };
		});
	}

	get onDidChangeTreeData() {
		return this._onDidChangeTreeData.event;
	}

	_onDidChangeTreeData = new vscode.EventEmitter();
}

// 课表视图的数据提供者
class ScheduleProvider {
	constructor() {
		this.schedule = [];
	}

	setSchedule(schedule) {
		this.schedule = schedule;
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element) {
		if (element.children) {
			const treeItem = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Collapsed);
			treeItem.contextValue = JSON.stringify(element.children);
			return treeItem;
		} else {
			return new vscode.TreeItem(element.label);
		}
	}

	getChildren(element) {
		if (element) {
			return element.children.map(child => new vscode.TreeItem(child.label));
		} else {
			return this.schedule.map(course => {
				return {
					label: course.courseName,
					children: course.timeAndPlaceList.map(timeAndPlace => {
						const weeks = timeAndPlace.classWeek.split('').map((week, index) => week === '1' ? index + 1 : null).filter(week => week).join(', ');
						return {
							label: `${timeAndPlace.teachingBuildingName} ${timeAndPlace.classroomName} - 周${timeAndPlace.classDay} 第${timeAndPlace.classSessions}节 连续${timeAndPlace.continuingSession}节 (周次: ${weeks})`
						};
					})
				};
			});
		}
	}

	get onDidChangeTreeData() {
		return this._onDidChangeTreeData.event;
	}

	_onDidChangeTreeData = new vscode.EventEmitter();
}

async function loginAndSaveHeadersAndCookies(headersFilePath, cookiesFilePath, credentialsFilePath) {
	const browser = await puppeteer.launch({ headless: false });
	const page = await browser.newPage();

	// 替换为实际的登录 URL
	await page.goto('https://jwxt.imu.edu.cn/login');

	// 读取存储的账号密码
	let username = '';
	let password = '';
	if (fs.existsSync(credentialsFilePath)) {
		const credentials = JSON.parse(fs.readFileSync(credentialsFilePath, 'utf8'));
		username = credentials.username;
		password = credentials.password;
	}

	// 填入账号和密码
	await page.type('#input_username', username);
	await page.type('#input_password', password);
	// 用户输入验证码登录
	await page.waitForNavigation({ waitUntil: 'networkidle0' });

	// 获取并保存 headers 和 cookies
	const headers = await page.evaluate(() => {
		const entries = window.performance.getEntriesByType('resource');
		return entries.length > 0 ? entries[0].responseHeaders : {};
	});

	const cookies = await page.cookies();

	fs.writeFileSync(headersFilePath, JSON.stringify(headers || {}));
	fs.writeFileSync(cookiesFilePath, JSON.stringify(cookies || []));

	await browser.close();
}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
