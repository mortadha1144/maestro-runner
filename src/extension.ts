import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let maestroTerminal: vscode.Terminal | undefined;

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('maestro-runner.runTestFile', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('Maestro Runner: No workspace folder open. Please open a folder first.');
			return;
		}

		const workspaceRoot = workspaceFolders[0].uri.fsPath;

		const config = vscode.workspace.getConfiguration('maestro-runner');
		const rawPath = config.get<string>('testFilesPath', '${workspaceFolder}/tests');
		const testDir = rawPath.replace(/\$\{workspaceFolder\}/g, workspaceRoot);

		if (!fs.existsSync(testDir)) {
			const action = await vscode.window.showErrorMessage(
				`Maestro Runner: Test directory not found: ${testDir}`,
				'Open Settings'
			);
			if (action === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'maestro-runner.testFilesPath');
			}
			return;
		}

		const pattern = new vscode.RelativePattern(testDir, '**/*.{yaml,yml}');
		const files = await vscode.workspace.findFiles(pattern);

		if (files.length === 0) {
			vscode.window.showWarningMessage(`Maestro Runner: No .yaml or .yml files found in ${testDir}`);
			return;
		}

		const items: vscode.QuickPickItem[] = files.map(file => ({
			label: path.relative(testDir, file.fsPath),
			description: file.fsPath,
		}));

		items.sort((a, b) => a.label.localeCompare(b.label));

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select a Maestro test file to run',
			matchOnDescription: true,
		});

		if (!selected) {
			return;
		}

		const filePath = selected.description!;

		if (!maestroTerminal || maestroTerminal.exitStatus !== undefined) {
			maestroTerminal = vscode.window.createTerminal({
				name: 'Maestro',
				cwd: workspaceRoot,
			});
		}

		maestroTerminal.show();
		maestroTerminal.sendText(`maestro test "${filePath}"`);
	});

	const terminalListener = vscode.window.onDidCloseTerminal(terminal => {
		if (terminal === maestroTerminal) {
			maestroTerminal = undefined;
		}
	});

	context.subscriptions.push(disposable, terminalListener);
}

export function deactivate() {}
